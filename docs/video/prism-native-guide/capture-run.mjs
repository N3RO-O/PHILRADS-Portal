import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const source = 'http://127.0.0.1:4186';
const toolDir = process.env.PRISM_VIDEO_TOOLS || join(process.env.TEMP, 'prism-video-tools');
const require = createRequire(join(toolDir, 'package.json'));
const { chromium } = require('playwright-core');
const group = process.argv[2];
if (!['home', 'field', 'work', 'core'].includes(group)) throw new Error('Choose home, field, work or core.');
const destination = join(here, 'capture', group);
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PRISM_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  args: ['--disable-background-timer-throttling'],
});
const context = await browser.newContext({
  viewport: { width: 412, height: 840 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'dark',
  geolocation: { latitude: 14.623, longitude: 121.032, accuracy: 30 },
  serviceWorkers: 'block',
});
context.setDefaultTimeout(3500);
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith('/programActivities.local.json')) {
    // Vite serves imports as JS. Never load the private, machine-local dataset.
    await route.fulfill({ contentType: 'application/javascript', body: 'export default [];' });
    return;
  }
  const publicAsset = ['fonts.googleapis.com', 'fonts.gstatic.com', 'tile.openstreetmap.org',
    'server.arcgisonline.com', 'api.open-meteo.com'].includes(url.hostname);
  if (url.hostname === '127.0.0.1' || publicAsset) await route.continue();
  else await route.abort();
});
const page = await context.newPage();
const captures = await readFile(join(destination, 'shots.json'), 'utf8').then(JSON.parse, () => []);
const go = async (path) => {
  const url = new URL(path, source);
  if (url.hostname !== '127.0.0.1') throw new Error('Capture navigation must stay on loopback.');
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#root').waitFor({ state: 'attached' });
  await page.waitForTimeout(600);
  await page.evaluate(() => document.fonts.ready);
};
async function shot(id, { at = 0, target = null, cue = '', settle = 260, focus = null } = {}) {
  if (!/^[a-z0-9-]+$/.test(id) || at < 0 || at >= 1) throw new Error(`Invalid shot ${id} @ ${at}`);
  let box = null;
  if (target) {
    if (typeof target.boundingBox === 'function') {
      if (await target.isVisible()) {
        await target.scrollIntoViewIfNeeded().catch(() => {});
        box = await target.boundingBox();
      }
    } else box = target;
  }
  await page.waitForTimeout(settle);
  if (target && typeof target.boundingBox === 'function' && box) box = await target.boundingBox();
  const file = `${id}-${String(Math.round(at * 1000)).padStart(3, '0')}.png`;
  const path = join(destination, file);
  await page.screenshot({ path, scale: 'device', caret: 'hide' });
  const data = { id, at, file: `capture/${group}/${file}`, cue,
    target: box && [box.x, box.y, box.width, box.height].map((v) => Math.round(v * 100) / 100), focus };
  const index = captures.findIndex((entry) => entry.id === id && entry.at === at);
  if (index < 0) captures.push(data);
  else captures[index] = data;
  await writeFile(join(destination, 'shots.json'), JSON.stringify(captures, null, 2));
  console.log(`Captured ${id} @ ${at}${cue ? ` · ${cue}` : ''}`);
}
try {
  const { capture } = await import(`./capture-${group}.mjs`);
  await capture({ page, context, go, shot, repo });
} finally {
  await browser.close();
}
