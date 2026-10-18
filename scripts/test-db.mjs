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
await check('staff records a receipt (+100)', () => as(B, `insert into public.inventory_movements (item_id, movement_type, quantity_change, recorded_by) select id, 'receipt', 100, '${B}' from public.inventory_items limit 1 returning quantity_change`).then(expectRows(1)));
await check('stock on hand updated by the ledger trigger', async () => {
  const q = (await as(B, `select quantity_on_hand::int q from public.inventory_items`)).rows[0].q;
  if (q !== 100) throw new Error(`quantity ${q}`);
  return q;
});
await check('release beyond stock is rejected', () => as(B, `insert into public.inventory_movements (item_id, movement_type, quantity_change, recorded_by) select id, 'release', -500, '${B}' from public.inventory_items limit 1`), true);
await check('receipt with a negative quantity is rejected', () => as(B, `insert into public.inventory_movements (item_id, movement_type, quantity_change, recorded_by) select id, 'receipt', -5, '${B}' from public.inventory_items limit 1`), true);
await check('staff cannot edit the stock ledger', () => as(B, `update public.inventory_movements set quantity_change = 999 returning id`).then(expectRows(0)));
await check('staff cannot change item quantity directly', () => as(B, `update public.inventory_items set quantity_on_hand = 9999 returning id`).then(expectRows(0)));
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
await db.exec(`reset role`);

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
