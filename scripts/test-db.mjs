// Applies every migration in supabase/migrations to an in-memory Postgres (PGlite)
// with a minimal stand-in for Supabase's auth schema, then checks the RLS rules.
// Usage: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('supabase/migrations');
const migration = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
  .join('\n');

const db = new PGlite();
const results = [];
const check = async (label, fn, expectError = false) => {
  try {
    const r = await fn();
    results.push(`${expectError ? 'FAIL (expected an error)' : 'ok  '} ${label}${r !== undefined ? ' -> ' + JSON.stringify(r) : ''}`);
  } catch (e) {
    results.push(`${expectError ? 'ok  ' : 'FAIL'} ${label} -> ${e.message.split('\n')[0]}`);
  }
};
const expectRows = (n) => (r) => {
  if (r.rows.length !== n) throw new Error(`expected ${n} row(s), got ${r.rows.length}`);
  return r.rows;
};

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  -- Supabase grants table privileges to API roles by default; RLS does the filtering.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);
await check('migrations apply', () => db.exec(migration).then(() => undefined));

const A = '00000000-0000-0000-0000-00000000000a'; // admin
const B = '00000000-0000-0000-0000-00000000000b'; // staff
const C = '00000000-0000-0000-0000-00000000000c'; // not yet activated
const D = '00000000-0000-0000-0000-00000000000d'; // viewer
await db.exec(`insert into auth.users (id, email) values ('${A}', 'admin@example.test'), ('${B}', 'staff@example.test'), ('${C}', 'new@example.test');`);
await check('new sign-ups get inactive profiles', async () => {
  const row = (await db.query(`select count(*)::int n, bool_or(is_active) any_active from public.profiles`)).rows[0];
  if (row.n !== 3 || row.any_active) throw new Error(JSON.stringify(row));
  return row;
});
await db.exec(`update public.profiles set is_active = true, role_key = 'admin' where id = '${A}'; update public.profiles set is_active = true where id = '${B}';`);

const as = async (uid, sql) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claim.role', 'authenticated', false);`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', '', false);`);
  }
};

// Admin sets up data
await check('admin creates project', () => as(A, `insert into public.projects (name, status, progress_percent) values ('Demo project', 'active', 40) returning name`).then(expectRows(1)));
await check('admin creates inventory item', () => as(A, `insert into public.inventory_items (name, unit, reorder_level) values ('Hygiene kits', 'kits', 50) returning name`).then(expectRows(1)));
await check('admin creates task for staff', () => as(A, `insert into public.tasks (title, priority, assignee_id, created_by, due_date) values ('Assigned to B', 'high', '${B}', '${A}', current_date + 2) returning title`).then(expectRows(1)));
await check('admin creates own private task', () => as(A, `insert into public.tasks (title, created_by) values ('Admin only', '${A}') returning title`).then(expectRows(1)));

// Staff member B
await check('staff sees only their own tasks', () => as(B, `select title from public.tasks`).then(expectRows(1)));
await check('staff cannot see projects they are not on', () => as(B, `select id from public.projects`).then(expectRows(0)));
await check('staff cannot create a project', () => as(B, `insert into public.projects (name) values ('Nope')`), true);
await check('staff cannot promote themselves', () => as(B, `update public.profiles set role_key = 'admin' where id = '${B}'`), true);
await check('staff can edit own display name', () => as(B, `update public.profiles set display_name = 'Staff B' where id = '${B}' returning display_name`).then(expectRows(1)));
// Inventory: every write goes through record_inventory_movement / decide_inventory_transfer
const rpc = (uid, args) => as(uid, `select public.record_inventory_movement(${args}) r`).then((r) => r.rows[0].r);
const cid = (n) => `'00000000-0000-4000-8000-${String(n).padStart(12, '0')}'`;
const ITEM = `(select id from public.inventory_items where name = 'Hygiene kits')`;
const PERISH = `(select id from public.inventory_items where name = 'Rice 25 kg')`;
const MNL = `(select id from public.inventory_locations where name = 'Manila')`;
const CEB = `(select id from public.inventory_locations where name = 'Cebu')`;
const LOT = (loc) => `(select id from public.inventory_batches where item_id = ${ITEM} and location_id = ${loc} and lot_number = 'L1')`;
const lotQty = async (loc) => Number((await db.query(`select quantity_on_hand from public.inventory_batches where id = ${LOT(loc)}`)).rows[0]?.quantity_on_hand ?? 0);
const expectQty = (loc, n) => async () => {
  const q = await lotQty(loc);
  if (q !== n) throw new Error(`lot quantity ${q}, expected ${n}`);
  return q;
};
await db.exec(`insert into auth.users (id, email) values ('${D}', 'viewer@example.test'); update public.profiles set is_active = true, role_key = 'viewer' where id = '${D}';`);
await check('admin creates locations', () => as(A, `insert into public.inventory_locations (name, kind) values ('Manila', 'warehouse'), ('Cebu', 'hub') returning name`).then(expectRows(2)));
await check('admin creates a perishable item', () => as(A, `insert into public.inventory_items (name, sku, category, unit, tracks_expiry) values ('Rice 25 kg', 'FD-001', 'Food', 'sacks', true) returning name`).then(expectRows(1)));
await check('SKU format is enforced', () => as(A, `insert into public.inventory_items (name, sku) values ('Bad', 'bad sku')`), true);
await check('duplicate item names are rejected', () => as(A, `insert into public.inventory_items (name) values ('hygiene KITS ')`), true);
await check('catalogue changes are logged', async () => {
  const n = (await db.query(`select count(*)::int n from public.activity_logs where module = 'inventory' and action = 'item.created'`)).rows[0].n;
  if (n < 2) throw new Error(`${n} log rows`);
  return n;
});
await check('staff cannot write the ledger directly', () => as(B, `insert into public.inventory_movements (item_id, movement_type, quantity_change, recorded_by) select id, 'receipt', 100, '${B}' from public.inventory_items limit 1`), true);
await check('staff receives 100 into lot L1', () => rpc(B, `${cid(1)}, 'receipt', ${ITEM}, ${MNL}, 100, p_lot_number => 'L1'`));
await check('lot quantity updated by the ledger trigger', expectQty(MNL, 100));
await check('retrying the same request records it once', async () => {
  const r = await rpc(B, `${cid(1)}, 'receipt', ${ITEM}, ${MNL}, 100, p_lot_number => 'L1'`);
  if (!r.duplicate) throw new Error('not flagged as duplicate');
  return expectQty(MNL, 100)();
});
await check('release beyond the lot is rejected', () => rpc(B, `${cid(2)}, 'release', ${ITEM}, ${MNL}, 500, ${LOT(MNL)}, p_reference => 'EC'`), true);
await check('release without a recipient is rejected', () => rpc(B, `${cid(3)}, 'release', ${ITEM}, ${MNL}, 5, ${LOT(MNL)}`), true);
await check('decimal quantities are rejected', () => rpc(B, `${cid(4)}, 'release', ${ITEM}, ${MNL}, 1.5, ${LOT(MNL)}, p_reference => 'EC'`), true);
await check('future-dated movements are rejected', () => rpc(B, `${cid(5)}, 'receipt', ${ITEM}, ${MNL}, 5, p_occurred_at => now() + interval '1 day'`), true);
await check('staff releases 30', () => rpc(B, `${cid(6)}, 'release', ${ITEM}, ${MNL}, 30, ${LOT(MNL)}, p_reference => 'Brgy. San Roque EC'`));
await check('lot now holds 70', expectQty(MNL, 70));
await check('perishable without an expiry date is rejected', () => rpc(B, `${cid(7)}, 'receipt', ${PERISH}, ${MNL}, 10`), true);
await check('already-expired goods cannot be received', () => rpc(B, `${cid(8)}, 'receipt', ${PERISH}, ${MNL}, 10, p_expiry_date => current_date - 3`), true);
await check('staff cannot adjust stock', () => rpc(B, `${cid(9)}, 'adjustment', ${ITEM}, ${MNL}, -5, ${LOT(MNL)}, p_notes => 'count'`), true);
await check('viewer cannot record movements', () => rpc(D, `${cid(10)}, 'receipt', ${ITEM}, ${MNL}, 5, p_lot_number => 'L1'`), true);
await check('staff transfer waits for approval', async () => {
  const r = await rpc(B, `${cid(11)}, 'transfer', ${ITEM}, ${MNL}, 20, ${LOT(MNL)}, ${CEB}, p_reference => 'Typhoon response'`);
  if (r.status !== 'pending') throw new Error(JSON.stringify(r));
  return expectQty(MNL, 70)();
});
await check('pending transfer reserves its stock (only 50 left to release)', () => rpc(B, `${cid(12)}, 'release', ${ITEM}, ${MNL}, 60, ${LOT(MNL)}, p_reference => 'EC'`), true);
const TRANSFER = `(select id from public.inventory_transfers where client_id = ${cid(11)})`;
await check('staff cannot approve transfers', () => as(B, `select public.decide_inventory_transfer(${TRANSFER}, true)`), true);
await check('staff cannot edit lots directly', () => as(B, `update public.inventory_batches set quantity_on_hand = 999`), true);
await check('rejecting needs a reason', () => as(A, `select public.decide_inventory_transfer(${TRANSFER}, false, '')`), true);
await check('admin approves the transfer', () => as(A, `select public.decide_inventory_transfer(${TRANSFER}, true)`).then(() => undefined));
await check('source lot down to 50', expectQty(MNL, 50));
await check('destination lot holds 20', expectQty(CEB, 20));
await check('a decided transfer cannot be decided again', () => as(A, `select public.decide_inventory_transfer(${TRANSFER}, false, 'late')`), true);
await check('admin writes off 5 with a reason', () => rpc(A, `${cid(13)}, 'adjustment', ${ITEM}, ${MNL}, -5, ${LOT(MNL)}, p_notes => 'Water damage'`));
await check('adjustment cannot go below zero', () => rpc(A, `${cid(14)}, 'adjustment', ${ITEM}, ${MNL}, -500, ${LOT(MNL)}, p_notes => 'x'`), true);
await check('expired lots cannot be released', async () => {
  // A lot that has since expired (received earlier, inserted as the database owner).
  await db.exec(`insert into public.inventory_batches (item_id, location_id, lot_number, expiry_date) values (${PERISH}, ${MNL}, 'OLD', current_date - 1);
    insert into public.inventory_movements (item_id, batch_id, location_id, movement_type, quantity_change)
      select item_id, id, location_id, 'receipt', 10 from public.inventory_batches where lot_number = 'OLD';`);
  return rpc(B, `${cid(15)}, 'release', ${PERISH}, ${MNL}, 1, (select id from public.inventory_batches where lot_number = 'OLD'), p_reference => 'EC'`);
}, true);
await check('staff cannot edit the stock ledger', () => as(B, `update public.inventory_movements set quantity_change = 999 returning id`), true);
await check('staff cannot change item quantity directly', () => as(B, `update public.inventory_items set quantity_on_hand = 9999 returning id`).then(expectRows(0)));
await check('viewer can read stock', () => as(D, `select id from public.inventory_batches`).then((r) => r.rows.length));
await check('dashboard summary runs as staff', () => as(B, `select metric, value::int from public.get_dashboard_summary()`).then(expectRows(6)));
await check('weekly response counts return 8 weeks', () => as(B, `select * from public.get_weekly_response_counts(8)`).then(expectRows(8)).then(() => undefined));

// Notifications: only read_at may change
await db.exec(`insert into public.notifications (recipient_id, title) values ('${B}', 'Hello')`);
await check('staff marks a notification read', () => as(B, `update public.notifications set read_at = now() returning title`).then(expectRows(1)));
await check('staff cannot rewrite notification text', () => as(B, `update public.notifications set title = 'changed'`), true);
await check('others cannot read the notification', () => as(A, `select id from public.notifications`).then(expectRows(0)));

// Inactive account and signed-out visitors
await check('inactive account sees no tasks', () => as(C, `select id from public.tasks`).then(expectRows(0)));
await check('inactive account still sees its own profile', () => as(C, `select id from public.profiles`).then(expectRows(1)));
await db.exec(`set role anon`);
await check('signed-out visitors cannot read tasks', () => db.query(`select * from public.tasks`), true);
await check('signed-out visitors cannot call the dashboard summary', () => db.query(`select * from public.get_dashboard_summary()`), true);
await check('signed-out visitors cannot record stock', () => db.query(`select public.record_inventory_movement(gen_random_uuid(), 'receipt', gen_random_uuid(), gen_random_uuid(), 1)`), true);
await db.exec(`reset role`);

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
