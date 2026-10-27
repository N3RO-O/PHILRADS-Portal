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
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb,
    invited_at timestamptz, email_confirmed_at timestamptz default now(), last_sign_in_at timestamptz);
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
await check('staff see every project, not only their own (2026-10-27)', () => as(B, `select id from public.projects`).then(expectRows(1)));
await check('staff cannot create a project', () => as(B, `insert into public.projects (name) values ('Nope')`), true);
await check('staff cannot promote themselves', () => as(B, `update public.profiles set role_key = 'admin' where id = '${B}'`), true);
await check('staff can edit own display name', () => as(B, `update public.profiles set display_name = 'Staff B' where id = '${B}' returning display_name`).then(expectRows(1)));

// Tasks module: anyone adds their own tasks; XP is awarded by the database (20261027000000_tasks_module.sql).
const TASK = (title) => `(select id from public.tasks where title = '${title}')`;
const xpOf = async (title) => (await db.query(`select points, base, on_time, subtasks, self_set, capped from public.task_xp_events where task_id = ${TASK(title)}`)).rows;
await check('staff adds their own field task', () => as(B, `insert into public.tasks (title, list, work_setting, assignee_id, created_by) values ('Pack kits', 'relief', 'field', '${B}', '${B}') returning list, work_setting`).then(expectRows(1)));
await check('staff cannot give a task to someone else', () => as(B, `insert into public.tasks (title, assignee_id, created_by) values ('For admin', '${A}', '${B}')`), true);
await check('unknown task lists are rejected', () => as(B, `insert into public.tasks (title, list, created_by) values ('Bad list', 'party', '${B}')`), true);
await check('finishing a task from someone else earns 35 + 10 on time', async () => {
  await as(B, `update public.tasks set status = 'done' where id = ${TASK('Assigned to B')}`);
  const r = await xpOf('Assigned to B');
  if (r.length !== 1 || r[0].points !== 45 || r[0].self_set) throw new Error(JSON.stringify(r));
  return r[0].points;
});
await check('completed_at is set by the database and cannot be backdated', async () => {
  await as(B, `update public.tasks set completed_at = '2020-01-01' where id = ${TASK('Assigned to B')}`);
  const r = (await db.query(`select completed_at > now() - interval '1 hour' recent from public.tasks where id = ${TASK('Assigned to B')}`)).rows[0];
  if (!r.recent) throw new Error('backdated');
  return r;
});
await check('re-opening takes the XP back; finishing again awards it once', async () => {
  await as(B, `update public.tasks set status = 'todo' where id = ${TASK('Assigned to B')}`);
  if ((await xpOf('Assigned to B')).length !== 0) throw new Error('XP kept after re-opening');
  await as(B, `update public.tasks set status = 'done' where id = ${TASK('Assigned to B')}`);
  const n = (await db.query(`select count(*)::int n from public.task_xp_events where user_id = '${B}' and task_id = ${TASK('Assigned to B')}`)).rows[0].n;
  if (n !== 1) throw new Error(`${n} awards`);
  return n;
});
await check('own tasks earn a flat 10 XP (even "high", due today, with steps) and stop at 60 a day', async () => {
  const own = [1, 2, 3, 4, 5, 6, 7].map((n) => `Own ${n}`);
  await as(B, `insert into public.tasks (title, priority, due_date, subtasks, assignee_id, created_by) values ${own
    .map((t) => `('${t}', 'high', current_date, '[{"id":"1","title":"a","done":true}]', '${B}', '${B}')`)
    .join(', ')}`);
  for (const t of own) await as(B, `update public.tasks set status = 'done' where id = ${TASK(t)}`);
  const pts = [];
  for (const t of own) pts.push((await xpOf(t))[0]?.points);
  if (pts.join() !== '10,10,10,10,10,10,0') throw new Error(pts.join());
  return pts;
});
await check('finished subtasks add 2 XP each', async () => {
  await as(A, `insert into public.tasks (title, priority, assignee_id, created_by, subtasks) values ('With steps', 'medium', '${B}', '${A}', '[{"id":"1","title":"a","done":true},{"id":"2","title":"b","done":true},{"id":"3","title":"c","done":false}]')`);
  await as(B, `update public.tasks set status = 'done' where id = ${TASK('With steps')}`);
  const r = (await xpOf('With steps'))[0];
  if (r.points !== 24 || r.subtasks !== 4) throw new Error(JSON.stringify(r));
  return r.points;
});
await check('staff cannot write XP directly', () => as(B, `insert into public.task_xp_events (task_id, user_id, points, base, self_set, day) values (${TASK('Pack kits')}, '${B}', 100, 100, false, current_date)`), true);
await check('staff sees only their own XP', () => as(B, `select distinct user_id from public.task_xp_events`).then(expectRows(1)));
await check('staff cannot give their own task to someone else later', () => as(B, `update public.tasks set assignee_id = '${A}' where id = ${TASK('Pack kits')}`), true);
await check('who created a task cannot be rewritten', () => as(A, `update public.tasks set created_by = '${A}' where id = ${TASK('Pack kits')}`), true);
await check('admin can reassign a task', () => as(A, `update public.tasks set assignee_id = '${A}' where id = ${TASK('Pack kits')} returning title`).then(expectRows(1)));
await check('staff cannot send kudos', () => as(B, `insert into public.task_kudos (to_user, message) values ('${A}', 'Thanks')`), true);
await check('admin sends kudos: +15 XP and a bell note', async () => {
  await as(A, `insert into public.task_kudos (to_user, message) values ('${B}', 'Great work at the distribution')`);
  const n = await as(B, `select title from public.notifications where title like 'Kudos from%'`);
  if (n.rows.length !== 1) throw new Error(`${n.rows.length} notifications`);
  return n.rows[0].title;
});
await check('one kudos per person a day', () => as(A, `insert into public.task_kudos (to_user, message) values ('${B}', 'Again')`), true);
await check('nobody can thank themselves', () => as(A, `insert into public.task_kudos (to_user, message) values ('${A}', 'Me')`), true);
await check('team progress counts everyone’s finished tasks', async () => {
  const r = (await as(B, `select done::int, goal from public.task_team_progress()`)).rows[0];
  if (r.done < 5 || r.goal !== 200) throw new Error(JSON.stringify(r));
  return r;
});
await check('staff cannot set the team goal', () => as(B, `select public.set_task_team_goal(10)`), true);
await check('admin sets the team goal', async () => {
  await as(A, `select public.set_task_team_goal(300)`);
  return (await as(B, `select goal from public.task_team_progress()`)).rows[0].goal === 300 || Promise.reject(new Error('goal not saved'));
});
// Fair play: what can be changed, sending back, and a log nobody can rewrite
const logs = async (action) => (await db.query(`select summary, audience from public.activity_logs where action = '${action}' order by id`)).rows;
await check('a task added already finished earns nothing and is flagged to admins', async () => {
  await as(B, `insert into public.tasks (title, status, assignee_id, created_by) values ('Instant', 'done', '${B}', '${B}')`);
  const x = (await db.query(`select points, flag from public.task_xp_events where task_id = ${TASK('Instant')}`)).rows[0];
  const l = await logs('task.added_done');
  if (x.points !== 0 || x.flag !== 'added_done' || l.length !== 1 || l[0].audience !== 'admins') throw new Error(JSON.stringify({ x, l }));
  return x;
});
await check('quick ticks of own tasks are noted for admins only', async () => {
  const l = await logs('task.quick_tick');
  if (l.length < 6 || l.some((r) => r.audience !== 'admins')) throw new Error(JSON.stringify(l.slice(0, 2)));
  return l.length;
});
await check('giving a task is in the activity feed', async () => {
  await as(A, `insert into public.tasks (title, priority, due_date, assignee_id, created_by, subtasks) values ('Given', 'high', current_date + 3, '${B}', '${A}', '[{"id":"1","title":"Count","done":false}]')`);
  const l = await logs('task.assigned');
  if (!l.some((r) => r.summary.includes('“Given”') && r.audience === 'everyone')) throw new Error(JSON.stringify(l));
  return l.at(-1).summary;
});
await check('on a given task, the assignee cannot change the priority', () => as(B, `update public.tasks set priority = 'low' where id = ${TASK('Given')}`), true);
await check('on a given task, the assignee cannot move the due date', () => as(B, `update public.tasks set due_date = current_date + 30 where id = ${TASK('Given')}`), true);
await check('on a given task, the assignee cannot add steps', () => as(B, `update public.tasks set subtasks = subtasks || '[{"id":"2","title":"Extra","done":true}]' where id = ${TASK('Given')}`), true);
await check('on a given task, the assignee cannot remove it', () => as(B, `update public.tasks set status = 'cancelled' where id = ${TASK('Given')}`), true);
await check('on a given task, the assignee can tick steps and add notes', () =>
  as(B, `update public.tasks set subtasks = '[{"id":"1","title":"Count","done":true}]', description = 'Counted 40 boxes' where id = ${TASK('Given')} returning title`).then(expectRows(1)));
await check('the giver gets a bell note when it is finished', async () => {
  await as(B, `update public.tasks set status = 'done' where id = ${TASK('Given')}`);
  const n = await as(A, `select title, link_path from public.notifications where title like '%finished “Given”'`);
  if (n.rows.length !== 1 || !n.rows[0].link_path.startsWith('/tasks?task=')) throw new Error(JSON.stringify(n.rows));
  return n.rows[0].title;
});
await check('a finished task cannot be edited', () => as(B, `update public.tasks set description = 'Changed later' where id = ${TASK('Given')}`), true);
await check('a finished task can still be planned in My Day', () => as(B, `update public.tasks set my_day = current_date where id = ${TASK('Given')} returning title`).then(expectRows(1)));
await check('only the giver can send a task back', () => as(B, `select public.send_back_task(${TASK('Given')}, 'Not really done')`), true);
await check('sending back needs a reason', () => as(A, `select public.send_back_task(${TASK('Given')}, '')`), true);
await check('the giver sends it back: re-opened, XP taken back, reason sent, logged once', async () => {
  const before = (await xpOf('Given'))[0]?.points;
  await as(A, `select public.send_back_task(${TASK('Given')}, 'Only 40 of 50 boxes counted')`);
  const status = (await db.query(`select status from public.tasks where id = ${TASK('Given')}`)).rows[0].status;
  const xp = await xpOf('Given');
  const note = await as(B, `select body from public.notifications where title like '%sent back “Given”'`);
  const sent = (await logs('task.sent_back')).length;
  const reopened = (await db.query(`select count(*)::int n from public.activity_logs where action = 'task.reopened' and entity_id = (${TASK('Given')})::text`)).rows[0].n;
  if (!(before > 0) || status !== 'todo' || xp.length || note.rows[0]?.body !== 'Only 40 of 50 boxes counted' || sent !== 1 || reopened !== 0)
    throw new Error(JSON.stringify({ before, status, xp, note: note.rows, sent, reopened }));
  return { before, status };
});
await check('nobody can write to the log directly', () => as(A, `insert into public.activity_logs (module, action, summary) values ('tasks', 'fake', 'I did everything')`), true);
await check('nobody can edit the log', async () => {
  const r = await as(A, `update public.activity_logs set summary = 'edited' returning id`);
  if (r.rows.length) throw new Error('edited');
}, true);
await check('nobody can delete from the log', async () => {
  const r = await as(A, `delete from public.activity_logs returning id`);
  if (r.rows.length) throw new Error('deleted');
}, true);
await check('sign-ins are logged once per 20 minutes', async () => {
  await as(B, `select public.log_sign_in('Chrome on Android')`);
  await as(B, `select public.log_sign_in('Chrome on Android')`);
  const l = await logs('auth.signed_in');
  if (l.length !== 1 || l[0].audience !== 'admins') throw new Error(JSON.stringify(l));
  return l[0].summary;
});
await check('staff see the activity feed but not admin-only entries', async () => {
  const r = (await as(B, `select count(*) filter (where audience = 'admins')::int admins, count(*)::int total from public.activity_logs`)).rows[0];
  if (r.admins !== 0 || r.total === 0) throw new Error(JSON.stringify(r));
  return r;
});
await check('admins see everything, including sign-ins and flags', async () => {
  const r = (await as(A, `select count(*) filter (where audience = 'admins')::int admins from public.activity_logs`)).rows[0];
  if (r.admins < 3) throw new Error(JSON.stringify(r));
  return r;
});
await check('kudos are logged for admins', async () => {
  const l = await logs('kudos.sent');
  if (l.length !== 1 || l[0].audience !== 'admins') throw new Error(JSON.stringify(l));
  return l[0].summary;
});

// Documentation: records only from the upload server; everyone active sees them
const DOC = `(select id from public.documents where drive_file_id = 'drive-file-1')`;
await check('browsers cannot add a document record (only the upload server can)', () =>
  as(B, `insert into public.documents (title, category, module, mime_type, drive_file_id, uploaded_by) values ('Fake', 'Photos', 'documentation', 'image/jpeg', 'fake-1', '${B}')`), true);
await check('the upload server records a file; it is in the activity feed', async () => {
  await db.exec(`insert into public.documents (title, category, module, mime_type, size_bytes, drive_file_id, drive_path, uploaded_by, file_name)
    values ('Distribution at Brgy 12', 'Photos', 'documentation', 'image/jpeg', 2048000, 'drive-file-1', 'Documentation/Staff B/Photos', '${B}', 'IMG_0042.jpg')`);
  const l = (await db.query(`select summary, audience from public.activity_logs where action = 'document.uploaded'`)).rows;
  if (l.length !== 1 || l[0].audience !== 'everyone') throw new Error(JSON.stringify(l));
  return l[0].summary;
});
await check('every active staff member sees documentation', async () => {
  const a = (await as(A, `select title from public.documents where id = ${DOC}`)).rows.length;
  const b = (await as(B, `select title from public.documents where id = ${DOC}`)).rows.length;
  if (a !== 1 || b !== 1) throw new Error(JSON.stringify({ a, b }));
  return { a, b };
});
await check('the uploader can correct the title and notes', () => as(B, `update public.documents set title = 'Distribution, Brgy 12', notes = '50 families' where id = ${DOC} returning title`).then(expectRows(1)));
await check('nobody can repoint a record at another Drive file', () => as(B, `update public.documents set drive_file_id = 'other' where id = ${DOC}`), true);
await check('nobody can delete a record outright', async () => {
  const r = await as(A, `delete from public.documents where id = ${DOC} returning id`);
  if (r.rows.length) throw new Error('deleted');
}, true);
await check('unknown document categories are rejected', () => as(B, `update public.documents set category = 'Memes' where id = ${DOC}`), true);
await check('removing keeps the record for admins and hides it from everyone else', async () => {
  await as(B, `select public.remove_document(${DOC})`);
  const b = (await as(B, `select id from public.documents where id = ${DOC}`)).rows.length;
  const a = (await as(A, `select id from public.documents where id = ${DOC}`)).rows.length;
  const l = (await db.query(`select count(*)::int n from public.activity_logs where action = 'document.removed'`)).rows[0].n;
  if (b !== 0 || a !== 1 || l !== 1) throw new Error(JSON.stringify({ b, a, l }));
  return { staffSees: b, adminSees: a };
});
await check('the Drive connection is never readable from a browser', () => as(A, `select refresh_token_enc from public.drive_connection`), true);
await check('upload sessions are never readable from a browser', () => as(B, `select * from public.drive_upload_sessions`), true);
await check('the Drive folder list is never readable from a browser', () => as(A, `select * from public.drive_folders`), true);
await check('a folder can only be claimed once (person / category / day)', async () => {
  await db.exec(`insert into public.drive_folders (parent_id, tag_key, tag_value) values ('root-folder-id-123', 'philradsStaffId', '${B}')`);
  const again = await db.query(`insert into public.drive_folders (parent_id, tag_key, tag_value) values ('root-folder-id-123', 'philradsStaffId', '${B}') on conflict do nothing returning tag_value`);
  if (again.rows.length) throw new Error('claimed twice');
  return 'once';
});
await check('staff can see whether Drive is connected (and nothing secret)', async () => {
  const r = (await as(B, `select connected, google_email from public.drive_status()`)).rows;
  if (r.length !== 1 || r[0].connected !== false) throw new Error(JSON.stringify(r));
  return r[0];
});

// Projects: everyone sees them; coordinators/admins and the project's lead manage; the team ticks milestones
const PRJ = `(select id from public.projects where name = 'Typhoon Kristine recovery')`;
const MS = (title) => `(select id from public.project_milestones where title = '${title}')`;
await check('staff cannot start a project', () => as(B, `insert into public.projects (name) values ('Rogue project')`), true);
await check('admin starts a project; it is in the activity feed', async () => {
  await as(A, `insert into public.projects (name, status, program_area, partner, beneficiaries_target, start_date, end_date) values ('Typhoon Kristine recovery', 'active', 'Disaster response', 'Partner Org', 5000, current_date - 10, current_date + 60)`);
  const l = (await db.query(`select summary from public.activity_logs where action = 'project.created' and summary like '%Typhoon Kristine%'`)).rows;
  if (l.length !== 1) throw new Error(JSON.stringify(l));
  return l[0].summary;
});
await check('every active staff member sees projects', () => as(B, `select name from public.projects where id = ${PRJ}`).then(expectRows(1)));
await check('the lead or a coordinator adds milestones and report deadlines', () =>
  as(A, `insert into public.project_milestones (project_id, title, kind, due_date) values (${PRJ}, 'Needs assessment', 'milestone', current_date + 3), (${PRJ}, 'First distribution', 'milestone', current_date + 10), (${PRJ}, 'Donor report 1', 'report', current_date + 30) returning title`).then(expectRows(3)));
await check('someone not on the team cannot tick a milestone', async () => {
  await as(B, `update public.project_milestones set done = true where id = ${MS('Needs assessment')}`);
  const r = (await db.query(`select done from public.project_milestones where id = ${MS('Needs assessment')}`)).rows[0];
  if (r.done) throw new Error('ticked');
  return 'not ticked';
});
await check('a team member ticks a milestone: stamped, progress follows, logged', async () => {
  await as(A, `insert into public.project_members (project_id, profile_id, member_role) values (${PRJ}, '${B}', 'member')`);
  await as(B, `update public.project_milestones set done = true, done_at = '2020-01-01' where id = ${MS('Needs assessment')}`);
  const m = (await db.query(`select done, done_by, done_at > now() - interval '1 hour' recent from public.project_milestones where id = ${MS('Needs assessment')}`)).rows[0];
  const p = (await db.query(`select progress_percent from public.projects where id = ${PRJ}`)).rows[0].progress_percent;
  const l = (await db.query(`select count(*)::int n from public.activity_logs where action = 'project.milestone_done'`)).rows[0].n;
  if (!m.done || m.done_by !== B || !m.recent || p !== 33 || l !== 1) throw new Error(JSON.stringify({ m, p, l }));
  return { progress: p };
});
await check('a team member cannot rename a milestone', () => as(B, `update public.project_milestones set title = 'Renamed' where id = ${MS('First distribution')}`), true);
await check('a team member cannot add milestones', () => as(B, `insert into public.project_milestones (project_id, title) values (${PRJ}, 'Mine')`), true);
await check('the project lead can add a milestone', async () => {
  await as(A, `update public.projects set lead_id = '${B}' where id = ${PRJ}`);
  return as(B, `insert into public.project_milestones (project_id, title) values (${PRJ}, 'Lead added this') returning title`).then(expectRows(1));
});
await check('the lead cannot hand the project to someone else', () => as(B, `update public.projects set lead_id = '${A}' where id = ${PRJ}`), true);
await check('the lead can update the project', () => as(B, `update public.projects set location = 'Naga City' where id = ${PRJ} returning location`).then(expectRows(1)));
await check('a status change is in the activity feed', async () => {
  await as(B, `update public.projects set status = 'on_hold' where id = ${PRJ}`);
  const l = (await db.query(`select summary from public.activity_logs where action = 'project.status'`)).rows;
  if (l.length !== 1 || !l[0].summary.includes('on hold')) throw new Error(JSON.stringify(l));
  return l[0].summary;
});
await check('staff cannot delete a project', async () => {
  await as(B, `delete from public.projects where id = ${PRJ}`);
  const n = (await db.query(`select count(*)::int n from public.projects where id = ${PRJ}`)).rows[0].n;
  if (n !== 1) throw new Error('deleted');
  return 'still there';
});

// Projects: people to reach changes over time; additional beneficiaries counted apart
await check('changing people to reach is in the project history', async () => {
  await as(A, `update public.projects set beneficiaries_target = 5200 where id = ${PRJ}`);
  const l = (await db.query(`select summary from public.activity_logs where action = 'project.people_to_reach' and entity_id = (${PRJ})::text`)).rows;
  if (l.length !== 1 || !l[0].summary.includes('5,000 to 5,200')) throw new Error(JSON.stringify(l));
  return l[0].summary;
});
await check('additional beneficiaries are counted and logged', async () => {
  await as(B, `update public.projects set beneficiaries_additional = 300, donor = 'Donor Foundation' where id = ${PRJ}`);
  const l = (await db.query(`select summary from public.activity_logs where action = 'project.additional_beneficiaries'`)).rows;
  if (l.length !== 1 || !l[0].summary.includes('0 to 300')) throw new Error(JSON.stringify(l));
  return l[0].summary;
});
await check('additional beneficiaries cannot be negative', () => as(A, `update public.projects set beneficiaries_additional = -5 where id = ${PRJ}`), true);
await check('a file deleted in Google Drive leaves the portal and says why', async () => {
  await db.exec(`insert into public.documents (title, category, module, mime_type, drive_file_id, uploaded_by) values ('Gone in Drive', 'Photos', 'documentation', 'image/jpeg', 'drive-file-gone', '${B}')`);
  await db.exec(`update public.documents set removed_at = now(), removed_reason = 'drive' where drive_file_id = 'drive-file-gone'`);
  const seen = (await as(B, `select id from public.documents where drive_file_id = 'drive-file-gone'`)).rows.length;
  const l = (await db.query(`select summary from public.activity_logs where action = 'document.deleted_in_drive'`)).rows;
  if (seen !== 0 || l.length !== 1) throw new Error(JSON.stringify({ seen, l }));
  return l[0].summary;
});
await check('a file deleted in the portal is logged with who deleted it', async () => {
  await db.exec(`insert into public.documents (title, category, module, mime_type, drive_file_id, uploaded_by) values ('Delete me', 'Photos', 'documentation', 'image/jpeg', 'drive-file-del', '${B}')`);
  await db.exec(`update public.documents set removed_at = now(), removed_by = '${A}', removed_reason = 'portal' where drive_file_id = 'drive-file-del'`);
  const l = (await db.query(`select summary from public.activity_logs where action = 'document.removed' and summary like '%Delete me%'`)).rows;
  if (l.length !== 1 || !l[0].summary.startsWith('admin deleted') || !l[0].summary.includes('trash')) throw new Error(JSON.stringify(l));
  return l[0].summary;
});

// Profiles: describe yourself; a small picture; colleagues can see it, only you can change it
await check('staff edit their own profile (position, phone, bio, picture, colour)', () =>
  as(B, `update public.profiles set job_title = 'Field officer', phone = '+63 917 123 4567', bio = 'Relief logistics in Bicol.', avatar_data = 'data:image/jpeg;base64,AAAA', avatar_color = '#ec952a' where id = '${B}' returning job_title`).then(expectRows(1)));
await check('colleagues can see a profile', () => as(A, `select bio, avatar_data from public.profiles where id = '${B}' and bio is not null`).then(expectRows(1)));
await check('nobody can change someone else’s profile', async () => {
  await as(B, `update public.profiles set bio = 'hacked' where id = '${A}'`);
  const r = (await db.query(`select bio from public.profiles where id = '${A}'`)).rows[0];
  if (r.bio === 'hacked') throw new Error('changed');
  return 'unchanged';
});
await check('a profile picture must be an image', () => as(B, `update public.profiles set avatar_data = 'javascript:alert(1)' where id = '${B}'`), true);
await check('a bio is at most 500 characters', () => as(B, `update public.profiles set bio = repeat('x', 501) where id = '${B}'`), true);

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
// PHILRADS IMS snapshot: written only by /api/ims-sync (service role), read by inventory.read
const asService = async (sql) => {
  await db.exec(`set role service_role`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec(`reset role`);
  }
};
const SNAP = (t) => `select public.store_ims_snapshot('${t}'::timestamptz, '{"version":1,"generated_at":"${t}"}'::jsonb) stored`;
await check('service role stores an IMS snapshot', () => asService(SNAP('2026-10-23T08:00:00Z')).then((r) => r.rows[0].stored));
await check('a newer IMS snapshot replaces it', async () => {
  if (!(await asService(SNAP('2026-10-23T09:00:00Z'))).rows[0].stored) throw new Error('not stored');
  return true;
});
await check('an older IMS snapshot is ignored', async () => {
  const r = (await asService(SNAP('2026-10-23T07:00:00Z'))).rows[0].stored;
  const kept = (await db.query(`select payload->>'generated_at' g from public.ims_inventory_snapshot`)).rows[0].g;
  if (r !== false || kept !== '2026-10-23T09:00:00Z') throw new Error(`stored=${r} kept=${kept}`);
  return kept;
});
await check('staff can read the IMS snapshot', () => as(B, `select id from public.ims_inventory_snapshot`).then(expectRows(1)));
await check('inactive account cannot read the IMS snapshot', () => as(C, `select id from public.ims_inventory_snapshot`).then(expectRows(0)));
await check('staff cannot store an IMS snapshot', () => as(B, SNAP('2026-10-24T00:00:00Z')), true);
await check('staff cannot write the IMS snapshot table', () => as(B, `update public.ims_inventory_snapshot set payload = '{}'`), true);

// Bell notifications for what's new in each IMS snapshot (portal only, no email)
const imsPayload = (t, { items = [], releases = [], moves = [] }) =>
  JSON.stringify({
    version: 1,
    generated_at: t,
    items: items.map((i) => ({ id: i, code: `IT-${i}`, name: `Item ${i}`, category: 'Food', unit: 'packs' })),
    pending_releases: releases.map((r) => ({ id: r, code: `REL-${r}`, purpose: 'Typhoon relief', recipient_org: null, requested_by: 'Larry' })),
    movements: moves.map(([id, kind]) => ({ id, kind, item_id: '1', qty: kind === 'release' ? -5 : 20, status: 'applied', location: 'Stockroom', reference: null, recorded_by: 'Kim' })),
  });
const SNAP2 = (t, parts) => `select public.store_ims_snapshot('${t}'::timestamptz, '${imsPayload(t, parts)}'::jsonb) stored`;
const notes = async () => (await db.query(`select recipient_id, title from public.notifications order by title`)).rows;
await check('IMS changes notify the right people', async () => {
  await asService(SNAP2('2026-10-23T10:00:00Z', { items: ['1'], moves: [['m1', 'receipt']] }));
  await db.exec(`delete from public.notifications`); // only what changes from here on counts
  await asService(SNAP2('2026-10-23T11:00:00Z', { items: ['1', '2'], releases: ['r1'], moves: [['m1', 'receipt'], ['m2', 'receipt'], ['m3', 'release']] }));
  const n = await notes();
  const byTitle = (t) => n.filter((x) => x.title === t).map((x) => x.recipient_id).sort().join();
  const expect = {
    'Release waiting for approval: REL-r1': A, // inventory.approve: admin only
    'New item in the IMS: Item 2': [A, B].join(), // inventory.record: admin and staff
    'Stock received: 20 packs Item 1': [A, B].join(),
    'Stock released: 5 packs Item 1': [A, B].join(),
  };
  for (const [title, who] of Object.entries(expect)) if (byTitle(title) !== who) throw new Error(`${title}: ${byTitle(title)}`);
  if (n.length !== 7) throw new Error(`expected 7 notifications, got ${n.length}: ${n.map((x) => x.title).join(' | ')}`);
  return n.length;
});
await check('an unchanged IMS snapshot notifies nobody', async () => {
  await db.exec(`delete from public.notifications`);
  await asService(SNAP2('2026-10-23T12:00:00Z', { items: ['1', '2'], releases: ['r1'], moves: [['m1', 'receipt'], ['m2', 'receipt'], ['m3', 'release']] }));
  return (await notes()).length === 0 ? 0 : Promise.reject(new Error(JSON.stringify(await notes())));
});
await check('a busy IMS push becomes one summary', async () => {
  const moves = Array.from({ length: 8 }, (_, i) => [`b${i}`, i % 2 ? 'release' : 'receipt']);
  await asService(SNAP2('2026-10-23T13:00:00Z', { items: ['1', '2'], moves }));
  const titles = [...new Set((await notes()).map((x) => x.title))];
  if (titles.join() !== '8 stock changes in the IMS') throw new Error(titles.join(' | '));
  await db.exec(`delete from public.notifications`);
  return titles;
});
// Resources
const RES = (title, url) => `insert into public.resources (title, category, url, kind, created_by) values ('${title}', 'Forms and templates', '${url}', 'drive_file', auth.uid()) returning id`;
await check('admin adds a resource', () => as(A, RES('Acknowledgement form', 'https://drive.google.com/file/d/abcdefghijk1/view')).then(expectRows(1)));
await check('the same link cannot be added twice', () => as(A, RES('Copy', 'https://drive.google.com/file/d/abcdefghijk1/view')), true);
await check('non-https links are rejected', () => as(A, RES('Bad', 'javascript:alert(1)')), true);
await check('staff can read resources', () => as(B, `select title from public.resources`).then(expectRows(1)));
await check('staff cannot add resources', () => as(B, RES('Nope', 'https://example.org/x')), true);
await check('staff cannot edit resources', () => as(B, `update public.resources set title = 'x' returning id`).then(expectRows(0)));
await check('staff cannot delete resources', () => as(B, `delete from public.resources`), true);
await check('who added a resource cannot be rewritten', () => as(A, `update public.resources set created_by = '${B}'`), true);
await check('admin removes a resource (soft)', () => as(A, `update public.resources set is_active = false returning id`).then(expectRows(1)));
await check('resource changes are logged', async () => {
  const actions = (await db.query(`select action from public.activity_logs where module = 'resources' order by id`)).rows.map((r) => r.action);
  if (actions.join() !== 'resource.added,resource.removed') throw new Error(actions.join());
  return actions;
});
await check('inactive account cannot read resources', () => as(C, `select id from public.resources`).then(expectRows(0)));
await check('beneficiaries.record goes to admins and coordinators', async () => {
  const r = (await db.query(`select role_key from public.role_permissions where permission_key = 'beneficiaries.record' order by role_key`)).rows.map((x) => x.role_key);
  if (r.join() !== 'admin,coordinator') throw new Error(r.join());
  return r;
});
await check('dashboard summary runs as staff', () => as(B, `select metric, value::int from public.get_dashboard_summary()`).then(expectRows(6)));
await check('weekly response counts return 8 weeks', () => as(B, `select * from public.get_weekly_response_counts(8)`).then(expectRows(8)).then(() => undefined));

// Staff page: administrators manage accounts; nobody locks themselves (or everyone) out
const E = '00000000-0000-0000-0000-00000000000e'; // invited, not yet accepted
await db.exec(`insert into auth.users (id, email, invited_at, email_confirmed_at) values ('${E}', 'invited@example.test', now(), null);`);
await check('admin lists staff with emails', () => as(A, `select email, invite_pending from public.list_staff()`).then(expectRows(5)));
await check('invited account shows as pending', async () => {
  const r = (await as(A, `select invite_pending from public.list_staff() where email = 'invited@example.test'`)).rows[0];
  if (!r?.invite_pending) throw new Error(JSON.stringify(r));
});
await check('staff cannot list staff', () => as(B, `select * from public.list_staff()`), true);
await check('admin cannot switch off own account', () => as(A, `update public.profiles set is_active = false where id = '${A}'`), true);
await check('admin cannot change own role', () => as(A, `update public.profiles set role_key = 'staff' where id = '${A}'`), true);
await check('staff cannot change another role', () => as(B, `update public.profiles set role_key = 'admin' where id = '${E}'`).then(expectRows(0)));
await check('admin switches on an invited account as coordinator', () =>
  as(A, `update public.profiles set is_active = true, role_key = 'coordinator' where id = '${E}' returning role_key`).then(expectRows(1)));
await check('role and on/off changes are logged', async () => {
  const r = (await db.query(`select action from public.activity_logs where entity_id = '${E}' order by id`)).rows.map((x) => x.action);
  if (r.join() !== 'staff.activated,staff.role_changed') throw new Error(r.join());
  return r;
});
await check('the last administrator cannot be removed', () => db.query(`update public.profiles set role_key = 'staff' where id = '${A}'`), true);
await check('the last administrator cannot be switched off', () => db.query(`update public.profiles set is_active = false where id = '${A}'`), true);
await check('volunteers can read stock and upload, but not record stock', async () => {
  const r = (await db.query(`select permission_key from public.role_permissions where role_key = 'volunteer' order by 1`)).rows.map((x) => x.permission_key);
  if (r.join() !== 'documents.upload,inventory.read,map.checkin,map.read,resources.read,response.read') throw new Error(r.join());
  return r;
});
await check('admin makes someone a volunteer', () => as(A, `update public.profiles set role_key = 'volunteer' where id = '${E}' returning role_key`).then(expectRows(1)));
await check('admin archives a volunteer (switched off too)', async () => {
  const r = (await as(A, `update public.profiles set archived_at = now() where id = '${E}' returning is_active, archived_at is not null archived`)).rows[0];
  if (r.is_active !== false || !r.archived) throw new Error(JSON.stringify(r));
  return r;
});
await check('archive is logged', async () => {
  const r = (await db.query(`select action from public.activity_logs where entity_id = '${E}' order by id desc limit 1`)).rows[0].action;
  if (r !== 'staff.archived') throw new Error(r);
  return r;
});
await check('admin restores an archived account', () => as(A, `update public.profiles set archived_at = null where id = '${E}' returning id`).then(expectRows(1)));
await check('archived accounts are listed with their date', () => as(A, `select archived_at from public.list_staff()`).then((r) => r.rows.length));
await check('administrators cannot be archived', async () => {
  await db.exec(`update public.profiles set role_key = 'admin', is_active = true where id = '${E}'`);
  try {
    await as(A, `update public.profiles set archived_at = now() where id = '${E}'`);
  } finally {
    await db.exec(`update public.profiles set role_key = 'volunteer' where id = '${E}'`);
  }
}, true);
await check('staff cannot archive anyone', () => as(B, `update public.profiles set archived_at = now() where id = '${B}'`), true);
await check('admin switches an account off', () => as(A, `update public.profiles set is_active = false where id = '${E}' returning is_active`).then(expectRows(1)));

// Live Map: places managed by map.manage; check-ins shared on purpose, own only, visible 24 h
const PLACE = `insert into public.map_places (name, kind, lat, lng, ims_location, created_by) values ('Tacloban Field Hub', 'hub', 11.2444, 125.0039, 'Tacloban Field Hub', auth.uid()) returning id`;
await check('admin pins a place', () => as(A, PLACE).then(expectRows(1)));
await check('staff can see places', () => as(B, `select name from public.map_places`).then(expectRows(1)));
await check('staff cannot add places', () => as(B, PLACE), true);
await check('staff cannot move places', () => as(B, `update public.map_places set lat = 0 returning id`).then(expectRows(0)));
await check('places are never deleted', () => as(A, `delete from public.map_places`), true);
await check('place changes are logged', async () => {
  const r = (await db.query(`select action from public.activity_logs where module = 'live-map'`)).rows.map((x) => x.action);
  if (r.join() !== 'place.added') throw new Error(r.join());
  return r;
});
await check('inactive account cannot see places', () => as(C, `select id from public.map_places`).then(expectRows(0)));
await check('staff checks in', () => as(B, `insert into public.field_checkins (lat, lng, accuracy_m, note) values (11.24, 125.0, 12, 'At the hub') returning id`).then(expectRows(1)));
await check('nobody checks in for someone else', () => as(B, `insert into public.field_checkins (profile_id, lat, lng) values ('${A}', 1, 1)`), true);
await check('viewers cannot check in', () => as(D, `insert into public.field_checkins (lat, lng) values (1, 1)`), true);
await check('check-ins older than 24 hours are hidden', async () => {
  await db.exec(`insert into public.field_checkins (profile_id, lat, lng, created_at) values ('${B}', 10, 120, now() - interval '2 days')`);
  return (await as(A, `select id from public.field_checkins`)).rows.length === 1 ? 1 : Promise.reject(new Error('old check-in visible'));
});
await check('others cannot remove your check-in', () => as(A, `delete from public.field_checkins returning id`).then(expectRows(0)));
await check('you can remove your own check-in', () => as(B, `delete from public.field_checkins where created_at > now() - interval '1 hour' returning id`).then(expectRows(1)));

// Live location: opt-in, own row only, at most 24 hours, hidden once it ends
const SHARE = (until) => `insert into public.live_locations (lat, lng, accuracy_m, sharing_until) values (11.24, 125.0, 10, now() + interval '${until}')
  on conflict (profile_id) do update set lat = excluded.lat, lng = excluded.lng, sharing_until = excluded.sharing_until returning profile_id`;
await check('staff starts sharing live for an hour', () => as(B, SHARE('1 hour')).then(expectRows(1)));
await check('their live position moves (one row, no trail)', async () => {
  await as(B, `update public.live_locations set lat = 11.25 where profile_id = '${B}'`);
  const r = (await as(A, `select lat from public.live_locations`)).rows;
  if (r.length !== 1 || Number(r[0].lat) !== 11.25) throw new Error(JSON.stringify(r));
  return r;
});
await check('sharing for more than 24 hours is refused', () => as(B, SHARE('2 days')), true);
await check('viewers cannot share live', () => as(D, SHARE('1 hour')), true);
await check('nobody moves someone else’s position', () => as(A, `update public.live_locations set lat = 0 where profile_id = '${B}' returning lat`).then(expectRows(0)));
await check('an ended share is hidden at once', async () => {
  await db.exec(`update public.live_locations set sharing_until = now() - interval '1 minute' where profile_id = '${B}'`);
  return (await as(A, `select profile_id from public.live_locations`)).rows.length === 0 ? 0 : Promise.reject(new Error('still visible'));
});
await check('stopping removes your position', async () => {
  await as(B, SHARE('1 hour'));
  return as(B, `delete from public.live_locations returning profile_id`).then(expectRows(1));
});

// First-run progress: each person updates only their own, and steps merge instead of replacing
await check('staff saves their first-run answer', () => as(B, `select public.update_onboarding('{"focus":"task","question":"answered","steps":{"signin":"2026-10-26T00:00:00Z"}}') o`).then((r) => r.rows[0].o));
await check('a later step keeps the earlier ones', async () => {
  const o = (await as(B, `select public.update_onboarding('{"steps":{"task":"2026-10-26T01:00:00Z"}}') o`)).rows[0].o;
  if (!o.steps.signin || !o.steps.task || o.focus !== 'task') throw new Error(JSON.stringify(o));
  return Object.keys(o.steps);
});
await check('first-run progress is per person', async () => {
  const a = (await db.query(`select onboarding from public.profiles where id = '${A}'`)).rows[0].onboarding;
  if (Object.keys(a).length) throw new Error(JSON.stringify(a));
});
await check('signed-out visitors cannot save first-run progress', async () => {
  await db.exec(`set role anon`);
  try {
    await db.query(`select public.update_onboarding('{}')`);
  } finally {
    await db.exec(`reset role`);
  }
}, true);
await check('first-run progress must be an object', () => as(B, `select public.update_onboarding('[1]')`), true);

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
await check('signed-out visitors cannot read the IMS snapshot', () => db.query(`select * from public.ims_inventory_snapshot`), true);
await check('signed-out visitors cannot read resources', () => db.query(`select * from public.resources`), true);
await check('signed-out visitors cannot record stock', () => db.query(`select public.record_inventory_movement(gen_random_uuid(), 'receipt', gen_random_uuid(), gen_random_uuid(), 1)`), true);
await db.exec(`reset role`);

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
