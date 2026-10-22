# Roles and permissions (to be confirmed)

PHILRADS has not yet confirmed its staff roles, so the database ships with a **configurable** model and **placeholder** values. Every seeded role and permission has `is_confirmed = false`.

## How it works

- `roles`: a list of roles (e.g. `admin`).
- `permissions`: a catalogue of permission keys (e.g. `tasks.read_all`).
- `role_permissions`: which roles have which permissions.
- `profiles.role_key`: each staff member’s role. `profiles.is_active` must be `true` before they can see any data.
- Row Level Security policies only ever call `has_permission('<key>')`, so changing who can do what is a data change in `role_permissions`. It needs no new migration unless a new kind of permission is required.

Some access applies to everyone, whatever their role: staff always see tasks assigned to or created by them, projects they lead or belong to, documents they uploaded, and their own notifications.

## Placeholder matrix

| Permission | admin | coordinator | staff | viewer |
| --- | :-: | :-: | :-: | :-: |
| projects.read_all | ✓ | ✓ | | |
| projects.manage | ✓ | ✓ | | |
| tasks.read_all | ✓ | ✓ | | |
| tasks.manage | ✓ | ✓ | | |
| inventory.read | ✓ | ✓ | ✓ | ✓ |
| inventory.record | ✓ | ✓ | ✓ | |
| inventory.manage | ✓ | | | |
| inventory.approve | ✓ | | | |
| resources.read | ✓ | ✓ | ✓ | ✓ |
| resources.manage | ✓ | ✓ | | |
| response.read | ✓ | ✓ | ✓ | ✓ |
| response.manage | ✓ | ✓ | | |
| documents.read_all | ✓ | ✓ | | |
| documents.upload | ✓ | ✓ | ✓ | |
| documents.manage | ✓ | | | |
| activity.read | ✓ | ✓ | ✓ | ✓ |
| staff.manage | ✓ | | | |
| settings.manage | ✓ | | | |

## Questions for PHILRADS

1. What are the real staff roles (e.g. Executive Director, Program Manager, Field Officer, Warehouse, Finance, Communications, Volunteer)?
2. Should field staff see all projects, or only their own?
3. Who may record stock movements, who approves transfers and stock adjustments/write-offs (`inventory.approve`), and who may create or retire inventory items?
4. Who may create and close response operations?
5. Who may see all uploaded documents? Are some categories (e.g. contracts, beneficiary lists) restricted further?
6. Who activates new staff accounts and assigns roles?
7. Should volunteers or partners have accounts at all?

## Changing it

Run as an administrator (SQL editor):

```sql
insert into public.roles (key, name, is_confirmed) values ('field_officer', 'Field Officer', true);
insert into public.role_permissions (role_key, permission_key) values
  ('field_officer', 'inventory.read'), ('field_officer', 'inventory.record'),
  ('field_officer', 'response.read'), ('field_officer', 'documents.upload');
update public.permissions set is_confirmed = true where key in ('inventory.read', 'inventory.record');
```

Then run `npm run test:db` and extend `scripts/test-db.mjs` for any new rule.
