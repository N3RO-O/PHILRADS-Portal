# PHILRADS Staff Portal

Internal staff portal for **Philippine Relief and Development Services, Inc. (PHILRADS)**: *Serving People in Jesus’ Name.*

A responsive, installable Progressive Web App (PWA) built with React, TypeScript, Vite and Tailwind CSS, designed for Supabase (database and staff sign-in), Google Drive (document files) and Vercel (hosting).

**Milestone 1 status:** the Home dashboard, navigation for all nine modules, PWA install/offline/update handling, the Supabase schema with Row Level Security, and the Google Drive upload boundary are in place. The eight other modules are placeholder pages. Until Supabase is connected, the dashboard shows **clearly labelled sample data**, not real PHILRADS figures.

---

## Quick start

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local   # optional: the app runs on sample data without it
npm run dev                  # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload (service worker disabled in dev) |
| `npm run build` | Type-checks, then builds the production app and service worker into `dist/` |
| `npm run preview` | Serves the production build at http://localhost:4173 (service worker active) |
| `npm run typecheck` | TypeScript checks only |
| `npm run test:db` | Applies `supabase/migrations` to an in-memory Postgres and checks the security rules |

## Environment variables

Set these in `.env.local` for local work, and in **Vercel → Project → Settings → Environment Variables** for Preview and Production.

| Variable | Required | Value |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | For live data | Your Supabase project URL, e.g. `https://abcd1234.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | For live data | The project’s **anon** (or publishable) key. Never the service-role key |
| `VITE_DATA_SOURCE` | No | `mock` (default) for sample data, `supabase` for live data with staff sign-in |

Anything prefixed `VITE_` is bundled into the browser, so it must be public. If a `VITE_` variable named like `SERVICE_ROLE`, `SECRET` or `PRIVATE_KEY` is ever added, the app logs an error in the browser console, but by then the value is already in the bundle, so never add one. Server-only secrets (Supabase service-role key, Google credentials) belong in Vercel server functions; see [docs/google-drive.md](docs/google-drive.md).

**Data modes**

- `mock`: no sign-in, a “Demo User” profile, and sample data marked *Sample* on every card plus a *Sample data* badge in the page header.
- `supabase`: staff must sign in with email and password. New accounts are **inactive** until an administrator activates them. Every query runs as the signed-in user, so Row Level Security decides what they see.

## Project structure

```
public/                      PWA icons, favicon, brand emblem (cropped from the branding guide)
src/
  components/layout/         Sidebar rail, mobile drawer, top bar, menus, online status
  components/dashboard/      Home dashboard cards
  components/documents/      Google Drive upload panel (boundary only)
  components/auth/           Sign-in state and access gate
  components/pwa/            Service-worker update prompt, install guidance
  components/ui/             Card, dialog, avatar, badges
  components/charts/         Area chart, paired bars, gauge (plain SVG/HTML)
  config/                    Environment, module list, verse of the day
  data/                      DEVELOPMENT-ONLY sample data
  hooks/                     Async data, online status, popover dismissal
  lib/                       Supabase client, formatting, install-prompt capture
  pages/                     Home, module placeholders, sign-in, 404
  services/                  Dashboard data (sample + Supabase) and Google Drive interface
  types/                     Shared domain types
supabase/migrations/         Database schema, RLS policies, dashboard functions
scripts/test-db.mjs          Local schema and RLS checks
docs/                        Google Drive plan, roles and permissions
```

The UI reads data only through `DashboardService` (`src/services/dashboard/types.ts`). `src/services/index.ts` picks the sample or Supabase implementation, so going live needs no component changes.

## Progressive Web App

- **Manifest:** name *PHILRADS Staff Portal*, short name *PHILRADS*, standalone display, dark `#1c1d21` theme and background (matching the interface), 192/512 icons plus maskable versions made from the official emblem.
- **Install:** Chrome, Edge and Android offer *Install app* in the profile menu. On iPhone/iPad the same menu item shows Safari’s *Share → Add to Home Screen* steps. No pop-ups nag staff to install.
- **Caching:** the service worker precaches only the built app shell (HTML, JS, CSS, icons) and caches the public Google Fonts files. Supabase, Google Drive and any other API traffic is **not** cached, so private staff records, tokens and documents are never stored in a service-worker cache.
- **Offline:** the interface still opens offline, including deep links such as `/tasks`. The header shows *Online/Offline*, and a notice explains that loading, saving and uploading need a connection. Nothing is shown as saved unless it really was. There is no offline write queue yet, by design.
- **Updates:** when a new version is deployed, staff see *“A new version of the portal is ready… Reload”*. The new version takes over only when they choose to reload. The app also checks for updates hourly while it is open. The footer shows the version and build.

To test locally, run `npm run build && npm run preview` and open http://localhost:4173 in Chrome or Edge. DevTools → Application shows the manifest and service worker. Service workers do not run in `npm run dev`.

## Supabase setup

1. Create a Supabase project. Don’t reuse an unrelated one.
2. Apply the schema, either way:
   - **SQL editor:** paste `supabase/migrations/20261018000000_initial_schema.sql` and run it, or
   - **CLI:** `supabase link --project-ref <ref>` then `supabase db push`.
3. **Authentication → Providers:** keep Email enabled. Turn **off** public sign-ups if staff accounts should only be created by an administrator (recommended), and invite staff from **Authentication → Users**.
4. Activate the first administrator in the SQL editor (it runs as `postgres`, which is allowed to change roles):
   ```sql
   update public.profiles
      set is_active = true, role_key = 'admin', display_name = 'Your Name'
    where id = (select id from auth.users where email = 'you@philrads.org');
   ```
5. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_DATA_SOURCE=supabase`.
6. Run `npm run test:db` after any schema change.

**Security model**

- Row Level Security is enabled on every table. Permissions are checked in the database, not just hidden in the UI.
- Roles map to permissions through `roles`, `permissions` and `role_permissions`. The seeded roles (`admin`, `coordinator`, `staff`, `viewer`) and permissions are **placeholders marked `is_confirmed = false`** until PHILRADS confirms them; see [docs/roles-and-permissions.md](docs/roles-and-permissions.md).
- Staff cannot change their own role or activation. The stock ledger (`inventory_movements`) is append-only and keeps `quantity_on_hand` in step through a trigger. Notifications can only be marked read by their recipient.
- Dashboard functions (`get_dashboard_summary`, `get_weekly_response_counts`) run with the caller’s permissions.

## Deploying to Vercel

Nothing has been deployed yet. To deploy:

1. Push this folder to a Git repository (GitHub, GitLab or Bitbucket).
2. In Vercel, **Add New → Project**, import the repository. The framework is detected as Vite and `vercel.json` sets the build command (`npm run build`) and output (`dist`).
3. Add the environment variables above for **Production** and **Preview** (use a separate Supabase project or branch for Preview if possible).
4. Deploy. Vercel serves over HTTPS, which service workers and installation require.

`vercel.json` already:

- rewrites every non-file, non-`/api` path to `index.html`, so refreshing `/tasks` works;
- serves `sw.js`, `manifest.webmanifest` and `index.html` with `must-revalidate`, so updates are picked up promptly;
- caches hashed `/assets/*` files for a year;
- adds basic security headers.

Optionally add the custom domain (e.g. `portal.philrads.org`) under **Settings → Domains**.

## Brand

Dark Burgundy `#640606`, Cloud `#F1F1F1`, Charcoal `#353535`, Uplifting Yellow `#EC952A`. The PHILRADS wordmark uses Archivo Black, the interface Montserrat, and the verse EB Garamond (Google Fonts, with system fallbacks). The emblem and app icons were cropped from the branding guide image. **Replace `public/brand/philrads-emblem.png` and the icons with the official high-resolution or vector emblem when available.**

**Design:** a clean dark interface modelled on the *Sales Management Dashboard* reference. Tokens live in `tailwind.config.js`:

| Token | Value | Use |
| --- | --- | --- |
| `page` | `#1c1d21` | App background, sidebar, installed-app title bar |
| `surface` / `surface-sunken` / `surface-raised` | `#26272c` / `#202125` / `#303137` | Cards / tiles inside cards / menus and hovers |
| `line` | `#36373d` | Borders and dividers |
| `ink` / `ink-soft` / `muted` | `#F1F1F1` (Cloud) / `#c4c6cd` / `#9a9ca6` | Text |
| `uplift` | `#EC952A` | The one highlight colour: selected navigation, primary buttons, main chart series |
| `rose` | `#D97B7B` | Light burgundy for second chart series and alerts (Dark Burgundy is too dark to read on a dark background) |

All text pairs meet WCAG AA (lowest is muted text on menus, 4.74:1). Shared styles are in `src/index.css`: `.card`, `.tile`, `.badge`, `.chip`, `.btn-primary`, `.btn-ghost`, `.popover`, `.field`.

**Layout:** full-height sidebar (expanded with labels by default, collapsible to an icon rail with hover labels; the choice is remembered per device), a top bar with search, status, notifications and account, and cards in aligned 12-column rows. Every module page uses the same card system (`src/pages/ModulePlaceholderPage.tsx`). Charts are plain SVG/HTML in `src/components/charts` (no chart library).

**Motion:** one smooth easing curve for every transition (`tailwind.config.js`), staggered card entrances, page fades, pop-in menus, a sliding mobile drawer and filling progress bars. Only transform and opacity animate, and all motion is switched off when the device asks for reduced motion.

**Shortcuts:** `Ctrl K` / `⌘K` jumps to search from anywhere.

## Still needed (credentials or decisions)

| Item | Needs |
| --- | --- |
| Live data and sign-in | A Supabase project, the migration applied, and the URL and anon key in Vercel |
| Real roles and permissions | PHILRADS to confirm staff roles and who can see or change what ([docs/roles-and-permissions.md](docs/roles-and-permissions.md)) |
| Google Drive uploads | Google Cloud project, Drive API, credentials, folder IDs and the server function ([docs/google-drive.md](docs/google-drive.md)) |
| PDM module | The official meaning and scope of “PDM” |
| Upload limits and file types | Confirm the proposed 2 GB limit and the accepted formats |
| Official emblem files | High-resolution or vector logo to replace the cropped raster |
| The eight other modules | Business rules for Live Map, Inventory, PDM, Documentation, Response, Projects, Tasks and Print Docs |
