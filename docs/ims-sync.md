# Showing PHILRADS IMS stock in the portal

PHILRADS IMS (`prds-ims`, PHP/MySQL, live on InfinityFree) is where stock is received, released and approved. The portal's Inventory page can show that stock read-only, so staff see one set of numbers.

## Why the IMS pushes instead of the portal fetching

InfinityFree only serves real browsers. Any other request (the portal's server, a script, another site's JavaScript) gets its `aes.js` bot-check page instead of data, and this cannot be turned off on the free plan. Outgoing requests from the IMS do work (the Discord relay already relies on this). So:

```
PHILRADS IMS  ──after every stock change──▶  POST /api/ims-sync (Vercel)  ──▶  Supabase ims_inventory_snapshot
                   signed with a shared key                                        │
                                                                 Portal Inventory page (read-only, signed-in staff)
```

- **When it sends:** after any IMS action that can change stock (receiving, editing items, adjustments, releases, approvals, voids, restores), and at least every 15 minutes while someone is using the IMS, so a missed push heals itself. The send runs after the IMS page has been returned, so staff never wait on it, and a failure never affects the IMS.
- **What it sends:** active items (code, name, category, unit, low-stock threshold, perishable flag), batches with stock (quantity, expiry, storage location), and up to 500 movements from the last 90 days (receipts, releases with their approval state, adjustments) with staff display names. It never sends donor names, beneficiary contacts, user emails or audit logs.
- **Security:** each push is signed (HMAC-SHA256 of timestamp + body) and must arrive within 5 minutes, so it can't be forged or replayed. The portal validates the shape and size before storing, keeps only the newest snapshot, and only signed-in staff with `inventory.read` can read it. The service-role key lives only in the Vercel function.
- **In the portal:** with `VITE_INVENTORY_SOURCE=ims`, the Inventory page shows the IMS stock with all the same views (cards/table, filters, expiry alerts, details, activity log, CSV and PDF exports, scanning to look items up). Logging movements, approvals and item editing are hidden; *Receive*, *Release* and *Open IMS* buttons open the IMS. A banner shows when the data was last updated and warns if it's over an hour old.

## Setup

Requires the portal connected to Supabase (`VITE_DATA_SOURCE=supabase`), so only signed-in staff can see real stock. Without it the page shows sample data.

1. **Supabase:** apply `supabase/migrations/20261023000000_ims_inventory_snapshot.sql` (after the earlier migrations).
2. **Make a shared key:** a long random string, e.g. run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
3. **Vercel → Settings → Environment Variables** (Production):
   - `IMS_SYNC_KEY` = the shared key
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase → Project Settings → API → service_role key
   - `VITE_INVENTORY_SOURCE` = `ims`
   - `VITE_IMS_URL` = the IMS address, e.g. `https://philrads-ims.page.gd` (no trailing slash)

   Redeploy. Open `https://<portal>/api/ims-sync`: it should say `"configured": true`.
4. **IMS `config/config.php`** (local and live), add:
   ```php
   // ── Staff Portal sync (docs/PORTAL_SYNC.md) ──
   define('PORTAL_SYNC_ENABLED', true);
   define('PORTAL_SYNC_URL',     'https://philrads-portal.vercel.app/api/ims-sync');
   define('PORTAL_SYNC_KEY',     'the shared key');
   ```
   and upload the changed IMS files (`app/Models/PortalSync.php`, `public/api.php`).
5. Do anything in the IMS (or just open it). Within seconds the portal's Inventory page shows the stock, and the banner shows the update time.

## Troubleshooting

- IMS side: `storage/logs/portal_sync.log` records failures; `storage/portal_sync.json` holds the last success time.
- `401 Bad signature`: the keys differ between Vercel and `config.php`.
- `401 Stale or missing timestamp`: the IMS server clock is more than 5 minutes off.
- `503 not configured`: a Vercel environment variable is missing; redeploy after adding it.
- The portal says the IMS hasn't sent data yet: check `PORTAL_SYNC_ENABLED` and that the files were uploaded.
