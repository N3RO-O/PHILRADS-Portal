import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

export async function capture({ page, context, go, shot, repo }) {
  const only = process.env.PRISM_HOME_ONLY?.split(',');
  const manifest = join(repo, 'docs', 'video', 'prism-native-guide', 'capture', 'home', 'shots.json');
  const previous = only ? await readFile(manifest, 'utf8').then(JSON.parse).catch(() => []) : [];
  page.setDefaultNavigationTimeout(25_000);
  page.setDefaultTimeout(6_000);
  const button = (name) => page.getByRole('button', { name }).first();
  const link = (name) => page.getByRole('link', { name }).first();
  const text = (name) => page.getByText(name, { exact: typeof name === 'string' }).first();
  const heading = (name) => page.getByRole('heading', { name }).first();
  const wait = (locator) => locator.waitFor({ state: 'visible', timeout: 5000 });
  const tap = async (locator) => { await wait(locator); await locator.tap(); };
  const center = async (locator) => {
    await wait(locator);
    await locator.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  };
  const snap = async (id, at, target, cue, options = {}) => {
    if (target && typeof target.waitFor === 'function') await wait(target);
    await shot(id, { at, target, cue, ...options });
  };
  const chapter = async (id, run) => {
    if (only && !only.includes(id)) return;
    try { await run(); } catch (error) { console.error(`${id}: ${error.message}`); }
  };
  const menu = () => button('Open navigation');
  const bell = () => button(/^Notifications(?:,|$)/i);
  const account = () => button('Account menu');
  const close = () => page.getByRole('dialog').filter({ visible: true }).getByRole('button', { name: 'Close', exact: true }).first();

  await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:4186' });
  // Keep this browser's records separate from any account or actual PHILRADS addresses.
  await context.addInitScript((showWelcome) => {
    if (localStorage.getItem('prism.capture.home.seed')) return;
    localStorage.setItem('prism.capture.home.seed', '1');
    localStorage.setItem('philrads.demo.role', 'staff');
    localStorage.setItem('philrads.onboarding.v1.demo', JSON.stringify({ question: 'skipped', hidden: true, coachSeen: true, steps: {} }));
    sessionStorage.setItem('philrads.sample-toast', '1');
    if (showWelcome) sessionStorage.setItem('prism.welcome.pending', '1');
    const now = new Date().toISOString();
    const places = [
      ['p-mnl', 'North Harbor Warehouse', 'warehouse', 14.58, 120.969, 'Main Manila Warehouse', null],
      ['p-tac', 'Sampaguita Field Hub', 'hub', 11.248, 125.018, 'Tacloban Field Hub', 'sample-ev-1'],
      ['p-sag', 'Sample Distribution Point', 'distribution_point', 11.22, 125.003, null, 'sample-ev-1'],
      ['p-guiuan', 'Demo Response Site', 'response_site', 11.033, 125.716, null, null],
    ].map(([id, name, kind, lat, lng, imsLocation, imsEventId]) => ({ id, name, kind, lat, lng, imsLocation, imsEventId, address: null, notes: 'Training example', updatedAt: now }));
    const checkIns = [{ id: 'c-1', profileId: 'sample-jori', name: 'Jori Sample', lat: 11.227, lng: 125.002, accuracyM: 20, note: 'Training check-in', createdAt: now, mine: false }];
    localStorage.setItem('philrads.sample.map.v2', JSON.stringify({ places, checkIns }));
    const staff = [
      ['demo-user', 'Demo User', 'admin', true], ['sample-jori', 'Jori Sample', 'coordinator', true],
      ['sample-tala', 'Tala Example', 'volunteer', true], ['sample-mika', 'Mika Demo', 'staff', false],
    ].map(([id, name, roleKey, isActive]) => ({ id, name, roleKey, isActive, email: `${id}@example.invalid`, invitePending: false, invitedAt: null, lastSignInAt: null, archivedAt: null }));
    localStorage.setItem('philrads.sample.staff.v2', JSON.stringify(staff));
  }, !only || only.includes('Home'));

  await chapter('Home', async () => {
    await go('/');
    // Retain the real welcome dialog; obscure the face in the app's stock welcome artwork.
    await page.addStyleTag({ content: '.welcome-tape { background-image: none !important; } .welcome-tape img { filter: blur(14px); }' });
    const letsGo = button(/^Let.s go/i);
    await snap('home-1', 0, letsGo, 'Let’s go');
    await tap(letsGo);
    await snap('home-2', 0, link('View my tasks'), 'View my tasks');
    await snap('home-2', .36, page.getByRole('region', { name: /verse of the day/i }).first(), 'Verse of the Day');
    await center(heading('Calendar'));
    await snap('home-2', .67, heading('Calendar'), 'Calendar');
    await center(heading('My tasks'));
    await snap('home-3', 0, heading(/needs your answer/i), 'Needs your answer');
    const today = page.getByRole('region', { name: 'Today', exact: true }).first().getByRole('heading');
    const next = page.locator('#task-box').getByRole('region', { name: 'Coming up', exact: true }).first().getByRole('heading');
    await center(today);
    await snap('home-3', .40, today, 'Today');
    await center(next);
    await snap('home-3', .72, next, 'Coming up');
  });

  await chapter('Navigation', async () => {
    await go('/');
    const search = page.getByRole('combobox', { name: 'Search anything' }).filter({ visible: true }).first();
    const active = button(/show the active list/i);
    await snap('home-4', 0, search, 'Search');
    await snap('home-4', .30, active, 'Active');
    await tap(active);
    await snap('home-4', .43, heading(/^Active$/i), 'Active teammates');
    await tap(page.getByRole('button', { name: 'Hide the Active list', exact: true }));
    await snap('home-4', .56, bell(), 'Notifications');
    await snap('home-4', .80, account(), 'Account');
    await snap('home-5', 0, menu(), 'Open navigation');
    await tap(menu());
    await snap('home-5', .36, link('Live Map'), 'Switch modules');
  });

  await chapter('Notifications', async () => {
    await page.evaluate(() => sessionStorage.removeItem('philrads.sample-toast'));
    await go('/');
    const toast = button(/nudged you about.*submit distribution photos/i);
    await snap('notifications-1', 0, toast, 'Tap the notification', { settle: 220 });
    await tap(toast);
    await wait(heading('Staff Tasks'));
    await snap('notifications-1', .48, heading('Staff Tasks'), 'Staff Tasks');
    await snap('notifications-2', 0, bell(), 'Open the bell');
    await tap(bell());
    const unread = page.getByRole('tab', { name: /^Unread/i }).first();
    await snap('notifications-2', .35, unread, 'All or Unread');
    await tap(unread);
    await snap('notifications-2', .68, unread, 'Unread');
    await page.keyboard.press('Escape');
    await tap(account());
    await snap('notifications-3', 0, text('Sound on notifications'), 'Sound on notifications');
    const status = button(/Online.*Change/i);
    await tap(status);
    const dnd = page.getByRole('radio', { name: /Do not disturb/i }).first();
    await snap('notifications-3', .48, dnd, 'Do not disturb');
    await tap(dnd);
    await snap('notifications-3', .77, button(/Do not disturb.*Change/i), 'Do not disturb');
  });

  await chapter('Live Map', async () => {
    await go('/live-map');
    const list = button(/^List\s*\d*$/i);
    await snap('live-map-1', 0, list, 'Places and teammates', { settle: 750 });
    await tap(list);
    await snap('live-map-1', .46, heading(/Places and team/i), 'Places and team');
    await tap(close());
    const share = button('Share location');
    await snap('live-map-2', 0, share, 'Share location');
    await tap(share);
    const sharing = page.getByRole('switch', { name: 'Share my live location' });
    await snap('live-map-2', .30, sharing, 'Share my live location');
    await tap(sharing);
    const start = button('Start sharing');
    await snap('live-map-2', .57, start, 'Start sharing');
    await tap(start);
    const bubble = button(/Sharing your live location until/i);
    await wait(bubble);
    await tap(close());
    await snap('live-map-2', .77, bubble, 'Sharing live');
    await tap(bubble);
    const stop = button(/^Stop$/i);
    await snap('live-map-3', 0, stop, 'Stop sharing');
    await tap(stop);
    await tap(share);
    const check = button('Check in here');
    await snap('live-map-3', .48, check, 'Check in here');
    await tap(check);
    await snap('live-map-3', .75, heading(/Check in/i), 'Check in once');
    await tap(close());
  });

  await chapter('Map details', async () => {
    await go('/live-map');
    await tap(button(/^List\s*\d*$/i));
    const place = page.getByRole('dialog', { name: /Places and team/i }).getByRole('button', { name: /Sampaguita Field Hub/i }).first();
    await center(place);
    await snap('live-map-4', 0, place, 'Tap a place');
    await tap(place);
    await snap('live-map-4', .43, heading(/Sampaguita Field Hub/i), 'Sampaguita Field Hub');
    const stock = heading(/Stock at this place|Live stock|Stock/i);
    if (await stock.isVisible()) {
      await center(stock);
      await snap('live-map-4', .73, stock, 'Stock and response');
    }
    await tap(close());
    const weather = button('Show weather');
    await snap('live-map-5', 0, weather, 'Show weather');
    await tap(weather);
    await snap('live-map-5', .35, button('Hide weather'), 'Weather layers');
    await tap(button('Hide weather'));
    await snap('live-map-5', .61, button('Full screen'), 'Full screen');
    await snap('live-map-5', .79, button('Show all places'), 'Show all places');
  });

  await chapter('PDM', async () => {
    await go('/');
    const letsGo = button(/^Let.s go/i);
    if (await letsGo.isVisible()) await tap(letsGo);
    await snap('pdm-1-short', 0, menu(), 'Open navigation');
    await tap(menu());
    const pdm = link(/^PDM/i);
    await snap('pdm-1-short', .56, pdm, 'Find PDM');
    await snap('pdm-2-short', 0, pdm, 'PDM');
    await snap('pdm-1', 0, pdm, 'PDM');
    await tap(pdm);
    await snap('pdm-1', .50, heading('PDM'), 'Coming soon');
    await snap('pdm-3-short', 0, heading('PDM'), 'Coming soon');
  });

  await chapter('Profile', async () => {
    await go('/profile');
    const photo = button(/Add a photo|Change your photo/i);
    await snap('profile-1', 0, photo, 'Change your photo');
    await page.locator('input[type=file][accept="image/*"]').setInputFiles(join(repo, 'public', 'pwa-512x512.png'));
    const zoom = button('Zoom in');
    await snap('profile-1', .43, zoom, 'Position your photo');
    await tap(zoom);
    await snap('profile-1', .73, page.getByRole('slider', { name: 'Zoom' }), 'Drag or zoom');
    await tap(button(/^Cancel$/i));
    const position = page.getByLabel('Position', { exact: true });
    await center(position);
    await position.fill('Field volunteer');
    await snap('profile-2', 0, position, 'Position');
    const bio = page.getByLabel('About me', { exact: true });
    await bio.fill('I support relief operations.');
    await snap('profile-2', .28, bio, 'About me');
    const frames = button(/unlocked.*Change/i);
    await center(frames);
    await snap('profile-2', .48, frames, 'Avatar frame');
    const privateOption = page.getByRole('radio', { name: /^Private/i }).first();
    await center(privateOption);
    await snap('profile-2', .73, privateOption, 'Public or Private');
    await go('/profile');
    await tap(account());
    await snap('profile-3', 0, text('What’s new'), 'What’s new');
    const light = page.getByRole('radio', { name: 'Light', exact: true }).first();
    await snap('profile-3', .28, light, 'Dark · Light · Auto');
    await tap(light);
    await snap('profile-3', .57, light, 'Light theme');
    await tap(page.getByRole('radio', { name: 'Dark', exact: true }).first());
    await snap('profile-3', .81, text('Sound on errors'), 'Sound switches');
  });

  await chapter('Admin', async () => {
    await page.evaluate(() => localStorage.setItem('philrads.demo.role', 'admin'));
    await go('/staff');
    const invite = page.getByRole('button', { name: /^Invite(?: someone)?$/i }).filter({ visible: true }).first();
    await snap('admin-1', 0, invite, 'Invite someone');
    await tap(invite);
    await page.getByLabel(/Email/i).first().fill('tala@example.invalid');
    await snap('admin-1', .39, heading('Invite someone'), 'Invite someone');
    const volunteer = page.getByRole('dialog').filter({ visible: true }).getByRole('radio', { name: /^Volunteer/i }).first();
    await center(volunteer);
    await snap('admin-1', .70, volunteer, 'Choose a role');
    await tap(close());
    const role = page.getByLabel('Role for Tala Example', { exact: true });
    const tala = text('Tala Example');
    await center(tala);
    await snap('admin-2', 0, tala, 'Role and account access');
    if (await role.isVisible()) await snap('admin-2', .23, role, 'Choose a role');
    const access = page.getByRole('switch', { name: /Tala Example.*account/i }).first();
    if (await access.isVisible()) await snap('admin-2', .42, access, 'Switch account on or off');
    await page.evaluate(() => localStorage.setItem('philrads.demo.role', 'volunteer'));
    await go('/');
    await tap(menu());
    await snap('admin-2', .58, link('Live Map'), 'Volunteer navigation');
    await page.evaluate(() => localStorage.setItem('philrads.demo.role', 'admin'));
    await go('/logs');
    const flags = button(/Flags to look at/i);
    await snap('admin-3', 0, flags, 'Flags to look at');
    await tap(flags);
    await snap('admin-3', .45, page.getByRole('radio', { name: /^Flags/i }).first(), 'Review flags');
  });

  await chapter('Field tips', async () => {
    await page.evaluate(() => localStorage.setItem('philrads.demo.role', 'staff'));
    await go('/');
    await tap(account());
    const quick = button(/Quick unlock/i);
    await snap('field-tips-1', 0, quick, 'Quick unlock');
    await tap(quick);
    await snap('field-tips-1', .35, heading(/Quick unlock/i), 'Quick unlock');
    await tap(close());
    await go('/live-map');
    await snap('field-tips-1', .67, button('Share location'), 'Share location');
    await context.setOffline(true);
    await snap('field-tips-2', 0, text(/You.re offline: places from your last visit/i), 'You’re offline');
    await context.setOffline(false);
    await page.evaluate(() => window.__whatsNew.updateFound(() => {}));
    await snap('field-tips-2', .52, button('Update now'), 'Update now');
  });
  await context.setOffline(false);
  if (only && previous.length) {
    const refreshed = JSON.parse(await readFile(manifest, 'utf8'));
    const shots = new Map(previous.map((entry) => [`${entry.id}:${entry.at}`, entry]));
    for (const entry of refreshed) shots.set(`${entry.id}:${entry.at}`, entry);
    await writeFile(manifest, JSON.stringify([...shots.values()], null, 2));
  }
}
