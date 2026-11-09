// Captures the real PRISM screens used in the video, from the portal's dev servers:
//   sample data:  npm run dev -- --port 5173              (http://localhost:5173)
//   sign-in:      npm run dev -- --mode live --port 5175  (http://localhost:5175; every Supabase call is
//                 answered here, so nothing reaches the real project)
// Usage: node capture.mjs <prism-video-tools dir> [shot ids...]
// Writes assets/app/<id>.jpg (390 × 844 at 2×) and assets/app/shots.json (tap targets in screen pixels).
// Only the captures change: the sample user is shown as Tala Cruz, and "Sample" badges are hidden.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const [tools = 'C:/Users/hp/AppData/Local/Temp/prism-video-tools', ...only] = process.argv.slice(2);
const require = createRequire(join(tools, 'package.json'));
const { chromium } = require('playwright-core');
const out = join(root, 'assets', 'app');
await mkdir(out, { recursive: true });
const MOCK = 'http://localhost:5173';
const LIVE = 'http://localhost:5175';
const W = 390;
const H = 844;
const photo = join(root, 'assets', 'sign-in-stills', '07.jpg');
const welcomeStill = await readFile(join(root, 'assets', 'sign-in-field.jpg'));
const browser = await chromium.launch({ executablePath: process.env.PRISM_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });

const onboarding = JSON.stringify({ question: 'skipped', hidden: true, coachSeen: true, steps: { signin: '2026-11-01T00:00:00.000Z' } });

async function context({ live = false, admin = false, offline = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: 'dark', isMobile: true, hasTouch: true,
    geolocation: { latitude: 11.2443, longitude: 125.0039 }, permissions: ['geolocation'], locale: 'en-PH', timezoneId: 'Asia/Manila',
  });
  await ctx.addInitScript(({ onboarding }) => {
    try {
      localStorage.setItem('prism.welcome.off', '1');
      localStorage.setItem('philrads.onboarding.v1.demo', onboarding);
      localStorage.setItem('philrads.whatsnew.seen', '9.9.9');
      sessionStorage.setItem('philrads.sample-toast', '1');
    } catch { /* storage blocked */ }
  }, { onboarding });
  // The sample user becomes Tala Cruz, a field officer (an admin for the admin clip).
  const rename = (body) => body
    .replace(/initials: (["'])DU/, "initials: $1TC")
    .replaceAll('Demo User', 'Tala Cruz')
    .replaceAll(' (demo)', '');
  for (const file of ['data/mockDashboard', 'data/mockTaskSeed', 'config/permissions', 'services/profiles/profileService', 'services/audit/auditService', 'services/documentation/documentationService']) {
    await ctx.route(`**/src/${file}.ts*`, async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, body: rename(await response.text()) });
    });
  }
  if (admin) await ctx.addInitScript(() => { try { localStorage.setItem('philrads.demo.role', 'admin'); } catch {} });
  // The welcome clip is a borrowed meme: show the app's own field footage instead.
  await ctx.route('**/media/welcome-dance*', (route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: welcomeStill }));
  if (live) {
    await ctx.route(/supabase\.co/, (route) => {
      const url = route.request().url();
      if (url.includes('/auth/v1/token')) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' }) });
      if (url.includes('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }
  if (offline) ctx.__offline = true;
  return ctx;
}

// Hides what only exists in sample mode, then settles animations.
async function clean(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[title^="Demonstration data"]')) el.style.display = 'none';
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && /^Try the portal as$/.test(el.textContent.trim())) {
        const box = el.closest('div[class*="border-t"]') ?? el.parentElement;
        box.style.display = 'none';
      }
    }
    // Toasts that pop in on their own (nudges, saves) aren't part of the step being shown.
    for (const el of document.querySelectorAll('body *')) {
      if (el.children.length || !/nudged you|Saved|Back online/.test(el.textContent)) continue;
      let box = el;
      while (box && box !== document.body && getComputedStyle(box).position !== 'fixed') box = box.parentElement;
      if (box && box !== document.body) box.style.display = 'none';
    }
    document.querySelector('[data-launch-toggle]')?.blur();
    document.activeElement?.blur?.();
  });
  await page.waitForTimeout(450);
}

function helpers(page, base) {
  const vis = (sel) => page.locator(sel + ' >> visible=true').first();
  return {
    page,
    go: async (path = '/') => { await page.goto(base + path); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1300); },
    click: async (sel, wait = 700) => { await vis(sel).click({ timeout: 6000 }); await page.waitForTimeout(wait); },
    tap: async (sel, wait = 700) => { await vis(sel).tap({ timeout: 6000 }).catch(() => vis(sel).click({ timeout: 6000 })); await page.waitForTimeout(wait); },
    type: async (sel, text) => { await vis(sel).fill(text, { timeout: 6000 }); await page.waitForTimeout(300); },
    keys: async (sel, text) => { await vis(sel).click({ timeout: 6000 }); await page.keyboard.type(text, { delay: 20 }); await page.waitForTimeout(300); },
    scroll: async (y) => { await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y); await page.waitForTimeout(500); },
    reveal: async (sel, offset = 120) => {
      await vis(sel).evaluate((el, offset) => {
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'instant' });
      }, offset);
      await page.waitForTimeout(500);
    },
    upload: async (sel = 'input[type=file]') => { await page.locator(sel).first().setInputFiles(photo); await page.waitForTimeout(1200); },
    wait: (ms) => page.waitForTimeout(ms),
  };
}

// Each shot: where it starts, what to do, then the controls to remember (name → selector).
const S = (id, opts, steps, marks = {}) => ({ id, ...opts, steps, marks });
const home = async (h) => h.go('/');
const shots = [
  // Sign-in (live server, signed out)
  S('signin', { live: true }, async (h) => { await h.go('/'); }, { sound: '[data-launch-toggle]', email: 'input[type=email]', volunteer: 'button:has-text("Volunteer")', guest: 'a:has-text("Guest")' }),
  S('signin-music', { live: true }, async (h) => { await h.go('/'); await h.click('[data-launch-toggle]'); }, { sound: '[data-launch-toggle]' }),
  S('signin-muted', { live: true }, async (h) => { await h.go('/'); await h.click('[data-launch-toggle]'); await h.click('[data-launch-toggle]'); }, { sound: '[data-launch-toggle]' }),
  S('signin-typed', { live: true }, async (h) => { await h.go('/'); await h.type('input[type=email]', 'tala.cruz@philrads.org'); await h.type('#sign-in-password', 'fieldwork'); }, { eye: '#sign-in-password ~ button, [aria-label*="password" i]', submit: 'form button[type=submit]' }),
  S('signin-shown', { live: true }, async (h) => { await h.go('/'); await h.type('input[type=email]', 'tala.cruz@philrads.org'); await h.type('#sign-in-password', 'fieldwork'); await h.click('[aria-label*="password" i]'); }, { submit: 'form button[type=submit]' }),
  S('signin-error', { live: true }, async (h) => { await h.go('/'); await h.type('input[type=email]', 'tala.cruz@philrads.org'); await h.type('#sign-in-password', 'fieldwork'); await h.click('form button[type=submit]', 1400); }, { forgot: 'button:has-text("Forgot your password?")' }),
  S('forgot', { live: true }, async (h) => { await h.go('/'); await h.type('input[type=email]', 'tala.cruz@philrads.org'); await h.click('button:has-text("Forgot your password?")'); }, { send: 'button:has-text("Email me a reset link")' }),
  S('vol-email', { live: true }, async (h) => { await h.go('/'); await h.click('button:has-text("Volunteer")'); await h.type('input[type=email]', 'tala.cruz@philrads.org'); }, { send: 'button:has-text("Email me a code")' }),
  S('vol-code', { live: true }, async (h) => { await h.go('/'); await h.click('button:has-text("Volunteer")'); await h.type('input[type=email]', 'tala.cruz@philrads.org'); await h.click('button:has-text("Email me a code")', 1400); }, { code: 'input[inputmode=numeric]' }),
  S('vol-code-typed', { live: true }, async (h) => { await h.go('/'); await h.click('button:has-text("Volunteer")'); await h.type('input[type=email]', 'tala.cruz@philrads.org'); await h.click('button:has-text("Email me a code")', 1400); await h.type('input[inputmode=numeric]', '384216'); }, { submit: 'form button[type=submit]' }),
  S('guest', { live: true }, async (h) => { await h.go('/guest'); await h.wait(1200); }, { back: 'a:has-text("Back to sign in")' }),

  // Home and getting around (sample data)
  S('welcome', { welcome: true }, home, { go: 'button:has-text("Let’s go"), button:has-text("Let\'s go")' }),
  S('home', {}, home, { tasks: 'a:has-text("View my tasks")', menu: '[aria-label="Open navigation"]', search: 'input[type=search]', active: '[aria-label*="others active"]', bell: '[aria-label^="Notifications"]', account: '[aria-label="Account menu"]' }),
  S('home-tasks', {}, async (h) => { await h.go('/'); await h.reveal('h2:has-text("My tasks")', 90); }, { open: 'a:has-text("Open Tasks")' }),
  S('drawer', {}, async (h) => { await h.go('/'); await h.click('[aria-label="Open navigation"]', 900); }, { pdm: 'nav a:has-text("PDM"), a:has-text("PDM")', tasks: 'a:has-text("Staff Tasks")' }),
  S('quick', {}, async (h) => { await h.go('/'); await h.click('[aria-label="Account menu"]'); await h.click('button:has-text("Quick unlock")', 900); }, { pin: 'button:has-text("PIN")' }),
  S('bell', {}, async (h) => { await h.go('/'); await h.click('[aria-label^="Notifications"]', 900); }, { first: 'button:has-text("Relief distribution logged"), a:has-text("Relief distribution logged")', unread: 'button:has-text("Unread")' }),
  S('bell-unread', {}, async (h) => { await h.go('/'); await h.click('[aria-label^="Notifications"]', 900); await h.click('button:has-text("Unread")'); }, { first: 'button:has-text("Relief distribution logged"), a:has-text("Relief distribution logged")' }),
  S('account', {}, async (h) => { await h.go('/'); await h.click('[aria-label="Account menu"]', 900); }, { sound: '[role=switch] >> nth=1', status: 'button:has-text("Change")', light: 'button:has-text("Light")', news: 'button:has-text("What’s new")' }),
  S('account-status', {}, async (h) => { await h.go('/'); await h.click('[aria-label="Account menu"]', 900); await h.click('button:has-text("Change")'); }, { dnd: 'button:has-text("Do not disturb"), [role=menuitemradio]:has-text("Do not disturb")' }),
  S('home-light', {}, async (h) => { await h.go('/'); await h.click('[aria-label="Account menu"]', 900); await h.click('button:has-text("Light")', 900); }, {}),

  // Staff Tasks
  S('tasks', {}, async (h) => { await h.go('/tasks'); }, { badges: 'button:has-text("Badges and rewards")', today: 'button:has-text("Today")', assigned: 'button:has-text("Assigned")', newtask: 'button:has-text("New task")' }),
  S('tasks-list', {}, async (h) => { await h.go('/tasks'); await h.reveal('button:has-text("Pack 200 hygiene kits")', 230); }, { start: 'button:has-text("Start")', card: 'button:has-text("Pack 200 hygiene kits")', newtask: 'button:has-text("New task")' }),
  S('tasks-assigned', {}, async (h) => { await h.go('/tasks'); await h.click('button:has-text("Assigned")'); await h.reveal('h2:has-text("Assigned to me"), h3:has-text("Assigned to me")', 140); }, { card: 'button:has-text("Pack 200 hygiene kits")' }),
  S('task-detail', {}, async (h) => { await h.go('/tasks'); await h.click('button:has-text("Pack 200 hygiene kits")', 900); }, { progress: 'button:has-text("In progress")', save: 'button:has-text("Save changes")' }),
  S('tasks-started', {}, async (h) => { await h.go('/tasks'); await h.click('button:has-text("Start")'); await h.reveal('button:has-text("Pack 200 hygiene kits")', 230); }, { finish: 'button:has-text("Finish")', card: 'button:has-text("Pack 200 hygiene kits")' }),
  S('finish', {}, async (h) => { await h.go('/tasks'); await h.click('button:has-text("Start")'); await h.click('button:has-text("Finish")', 900); await h.type('textarea', 'Food packs and hygiene kits handed out to 120 families.'); }, { photo: 'button:has-text("Add photos"), label:has-text("Add photos")', note: 'textarea', done: 'dialog[open] button:has-text("Finish")' }),
  S('finish-photo', {}, async (h) => { await h.go('/tasks'); await h.click('button:has-text("Start")'); await h.click('button:has-text("Finish")', 900); await h.type('textarea', 'Food packs and hygiene kits handed out to 120 families.'); await h.upload('dialog[open] input[type=file]'); }, { done: 'dialog[open] button:has-text("Finish")' }),
  S('tasks-done', {}, async (h) => { await h.go('/tasks'); await h.click('button:has-text("Start")'); await h.click('button:has-text("Finish")', 900); await h.upload('dialog[open] input[type=file]'); await h.click('dialog[open] button:has-text("Finish")', 1600); }, {}),
  S('newtask', {}, async (h) => { await h.go('/tasks'); await h.click('button:has-text("New task")', 900); }, { title: 'dialog[open] input[placeholder="What needs doing?"]' }),
  S('newtask-typed', {}, async (h) => { await h.go('/tasks'); await h.click('button:has-text("New task")', 900); await h.type('dialog[open] input[placeholder="What needs doing?"]', 'Photograph relief distribution'); await h.click('dialog[open] button:has-text("Field")'); await h.click('dialog[open] button:has-text("Today")'); }, { add: 'dialog[open] button:has-text("Add task")', priority: 'dialog[open] button:has-text("High")' }),
  S('badges', {}, async (h) => { await h.go('/tasks'); await h.click('button:has-text("Badges and rewards")', 1000); }, {}),

  // Live Map
  S('map', {}, async (h) => { await h.go('/live-map'); await h.wait(1500); }, { share: 'button:has-text("Share location")', weather: '[aria-label="Show weather"]', full: '[aria-label="Full screen"]', all: '[aria-label="Show all places"]', list: 'button:has-text("List")', place: '.leaflet-marker-icon[role=button] >> nth=4' }),
  S('map-share', {}, async (h) => { await h.go('/live-map'); await h.click('button:has-text("Share location")', 900); }, { toggle: '[aria-labelledby="live-share-title"]', checkin: 'button:has-text("Check in here")' }),
  S('map-sharing', {}, async (h) => { await h.go('/live-map'); await h.click('button:has-text("Share location")', 900); await h.click('[aria-labelledby="live-share-title"]', 1500); await h.page.keyboard.press('Escape'); await h.wait(900); }, { stop: 'button:has-text("Stop")' }),
  S('map-place', {}, async (h) => { await h.go('/live-map'); await h.wait(1200); await h.page.locator('.leaflet-marker-icon[role=button]').nth(4).evaluate((el) => el.click()); await h.wait(1200); }, {}),
  S('map-weather', {}, async (h) => { await h.go('/live-map'); await h.wait(1200); await h.click('[aria-label="Show weather"]', 1600); }, { full: '[aria-label="Full screen"]', all: '[aria-label="Show all places"]' }),

  // Inventory
  S('inv', {}, async (h) => { await h.go('/inventory'); }, { stock: 'button:has-text("In stock")' }),
  S('inv-list', {}, async (h) => { await h.go('/inventory'); await h.reveal('input[placeholder^="Search item"]', 110); }, { search: 'input[placeholder^="Search item"]', export: 'button:has-text("Export")', log: 'button:has-text("Activity log")' }),
  S('inv-search', {}, async (h) => { await h.go('/inventory'); await h.reveal('input[placeholder^="Search item"]', 110); await h.type('input[placeholder^="Search item"]', 'family food'); }, { item: 'button:has-text("Family food pack") >> nth=0', location: 'select >> nth=1' }),
  S('inv-item', {}, async (h) => { await h.go('/inventory'); await h.reveal('input[placeholder^="Search item"]', 110); await h.type('input[placeholder^="Search item"]', 'family food'); await h.click('button:has-text("Family food pack")', 1000); }, {}),
  S('inv-log', {}, async (h) => { await h.go('/inventory'); await h.reveal('input[placeholder^="Search item"]', 110); await h.click('button:has-text("Activity log")', 900); await h.reveal('button:has-text("Activity")', 160); }, {}),
  S('inv-export', {}, async (h) => { await h.go('/inventory'); await h.reveal('input[placeholder^="Search item"]', 110); await h.click('button:has-text("Export")', 800); }, { csv: 'button:has-text("Excel / Sheets")' }),

  // Response
  S('resp', {}, async (h) => { await h.go('/response'); }, { pending: 'h3:has-text("Medical mission")' }),
  S('resp-events', {}, async (h) => { await h.go('/response'); await h.reveal('text=Relief events and beneficiaries', 100); }, { event: 'text=Typhoon response: Eastern Visayas >> nth=0' }),
  S('resp-event', {}, async (h) => { await h.go('/response'); await h.reveal('text=Relief events and beneficiaries', 100); await h.click('text=Typhoon response: Eastern Visayas >> nth=0', 1200); }, {}),

  // Documentation
  S('docs', {}, async (h) => { await h.go('/documentation'); }, { upload: 'button:has-text("Upload")', media: 'button:has-text("Media")' }),
  S('docs-up', {}, async (h) => { await h.go('/documentation'); await h.click('button:has-text("Upload") >> nth=-1', 1000); await h.upload('dialog[open] input[type=file]'); }, { project: 'dialog[open] select >> nth=0', send: 'dialog[open] button:has-text("Upload")' }),
  S('docs-media', {}, async (h) => { await h.go('/documentation'); await h.click('button:has-text("Media")', 900); }, {}),

  // Forms
  S('forms', {}, async (h) => { await h.go('/forms'); }, { report: 'a:has-text("Activity Report")' }),
  S('form', {}, async (h) => { await h.go('/forms'); await h.click('a:has-text("Activity Report")', 1200); }, { bigger: '[aria-label="Bigger text"], button:has-text("A+")', print: 'button:has-text("Print / Save as PDF")', field: 'input[data-k=location]' }),
  S('form-big', {}, async (h) => { await h.go('/forms'); await h.click('a:has-text("Activity Report")', 1200); await h.click('[aria-label="Bigger text"], button:has-text("A+")'); await h.click('[aria-label="Bigger text"], button:has-text("A+")'); }, {}),
  S('form-sign', {}, async (h) => { await h.go('/forms'); await h.click('a:has-text("Activity Report")', 1200); await h.reveal('[aria-label="Sign here"], button:has-text("Sign here")', 380); }, { pad: '[aria-label="Sign here"], button:has-text("Sign here")' }),
  S('sign-sheet', {}, async (h) => { await openSign(h); }, { canvas: 'dialog[open] canvas' }),
  S('sign-drawn', {}, async (h) => { await openSign(h); await drawSign(h); }, { canvas: 'dialog[open] canvas', use: 'button:has-text("Use this signature")' }),
  S('form-signed', {}, async (h) => { await openSign(h); await drawSign(h); await h.click('button:has-text("Use this signature")', 1100); await h.reveal('[aria-label="Change signature"]', 380); }, {}),

  // Projects, Resources, Statistics, PDM
  S('projects', {}, async (h) => { await h.go('/projects'); }, { project: 'a:has-text("Typhoon Kristine")' }),
  S('project', {}, async (h) => { await h.go('/projects'); await h.click('a:has-text("Typhoon Kristine")', 1200); }, {}),
  S('project-tasks', {}, async (h) => { await h.go('/projects'); await h.click('a:has-text("Typhoon Kristine")', 1200); await h.reveal('input[placeholder*="task" i]', 300); }, { newtask: 'input[placeholder*="task" i]' }),
  S('res', {}, async (h) => { await h.go('/resources'); await h.reveal('button:has-text("Forms and templates")', 150); }, { policies: 'button:has-text("Policies and guidelines")', preview: 'button:has-text("Preview")', more: '[aria-label^="More for Relief"]' }),
  S('res-more', {}, async (h) => { await h.go('/resources'); await h.reveal('button:has-text("Forms and templates")', 150); await h.click('[aria-label^="More for Relief"]'); }, { google: 'text=Open in Google' }),
  S('stats', {}, async (h) => { await h.go('/statistics'); }, { year: 'button:has-text("2026")' }),
  S('stats-numbers', {}, async (h) => { await h.go('/statistics'); await h.reveal('text=Responses and initiatives', 120); }, {}),
  S('pdm', {}, async (h) => { await h.go('/pdm'); }, {}),

  // Profile
  S('profile', {}, async (h) => { await h.go('/profile'); }, { photo: 'button:has-text("Add a photo"), [aria-label="Change your photo"]' }),
  S('profile-crop', {}, async (h) => { await h.go('/profile'); await h.upload('input[type=file]'); }, { save: 'button:has-text("Save"), button:has-text("Use photo")' }),
  S('profile-about', {}, async (h) => { await h.go('/profile'); await h.reveal('input[placeholder="e.g. Field officer"]', 220); await h.type('input[placeholder="e.g. Field officer"]', 'Field officer'); }, { frame: 'button:has-text("Change")', private: 'button:has-text("Private")', bio: 'textarea' }),

  // Field tips
  S('offline', { offline: true }, async (h) => { await h.go('/'); await h.page.context().setOffline(true); await h.page.evaluate(() => window.dispatchEvent(new Event('offline'))); await h.wait(1200); }, {}),
  S('whatsnew', {}, async (h) => { await h.go('/'); await h.click('[aria-label="Account menu"]', 900); await h.click('button:has-text("What’s new")', 1000); }, { ok: 'button:has-text("Got it")' }),

  // Coordinators and admins
  S('staff', { admin: true }, async (h) => { await h.go('/staff'); }, { invite: 'button:has-text("Invite")' }),
  S('staff-invite', { admin: true }, async (h) => { await h.go('/staff'); await h.click('button:has-text("Invite")', 1000); }, { role: 'dialog[open] select' }),
  S('logs', { admin: true }, async (h) => { await h.go('/logs'); }, { flags: 'button:has-text("Flag"), button:has-text("flag")' }),
];

const SIGN = '[aria-label="Sign here"], button:has-text("Sign here")';
async function openSign(h) {
  await h.go('/forms'); await h.click('a:has-text("Activity Report")', 1200);
  await h.reveal(SIGN, 380); await h.click(SIGN, 1000);
}
async function drawSign(h) {
  const area = await h.page.locator('dialog[open] canvas >> visible=true').first().boundingBox();
  const pts = [[.1, .68], [.18, .3], [.25, .26], [.21, .7], [.33, .48], [.4, .62], [.48, .38], [.55, .64], [.63, .46], [.72, .58], [.9, .42]];
  await h.page.mouse.move(area.x + area.width * pts[0][0], area.y + area.height * pts[0][1]);
  await h.page.mouse.down();
  for (const [x, y] of pts.slice(1)) await h.page.mouse.move(area.x + area.width * x, area.y + area.height * y, { steps: 10 });
  await h.page.mouse.up();
  await h.wait(500);
}

const results = JSON.parse(await readFile(join(out, 'shots.json'), 'utf8').catch(() => '{}'));
for (const shot of shots) {
  if (only.length && !only.includes(shot.id)) continue;
  const ctx = await context(shot);
  if (shot.welcome) await ctx.addInitScript(() => { try { localStorage.removeItem('prism.welcome.off'); sessionStorage.setItem('prism.welcome.pending', '1'); } catch {} });
  const page = await ctx.newPage();
  const h = helpers(page, shot.live ? LIVE : MOCK);
  try {
    await shot.steps(h);
    await clean(page);
    const marks = {};
    for (const [name, sel] of Object.entries(shot.marks)) {
      const box = await page.locator(sel + ' >> visible=true').first().boundingBox({ timeout: 1500 }).catch(() => null);
      if (box) marks[name] = [box.x, box.y, box.width, box.height].map((v) => Math.round(v * 10) / 10);
      else console.log(`  ${shot.id}: no "${name}"`);
    }
    await page.screenshot({ path: join(out, `${shot.id}.jpg`), type: 'jpeg', quality: 88 });
    results[shot.id] = { marks, path: new URL(page.url()).pathname };
    console.log(`shot ${shot.id}`);
  } catch (error) {
    console.log(`FAIL ${shot.id}: ${String(error.message).split('\n')[0].slice(0, 160)}`);
  }
  await ctx.close();
}
await writeFile(join(out, 'shots.json'), JSON.stringify(results, null, 1));
await browser.close();
