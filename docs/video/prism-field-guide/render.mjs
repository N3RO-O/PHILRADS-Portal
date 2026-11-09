import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { basename, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenes } from './scenes.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const [tools, cache, ffmpeg, mode = 'render'] = process.argv.slice(2);
const require = createRequire(join(tools, 'package.json'));
const { chromium } = require('playwright-core');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ executablePath: process.env.PRISM_BROWSER || edge, headless: true,
  args: ['--disable-dev-shm-usage', '--disable-background-timer-throttling'] });
const output = join(root, 'exports');
const contentType = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4', '.mp4': 'video/mp4' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!path.startsWith(resolve(root) + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const { size } = await stat(path);
    res.writeHead(200, { 'Content-Type': contentType[extname(path)] || 'application/octet-stream',
      'Content-Length': size, 'Cache-Control': 'public, max-age=3600' });
    createReadStream(path).pipe(res);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const local = `http://127.0.0.1:${server.address().port}`;

function run(args) {
  return new Promise((ok, fail) => {
    const child = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let diagnostic = '';
    child.stderr.on('data', (message) => { diagnostic += message; });
    child.on('error', fail);
    child.on('close', (code) => code === 0 ? ok() : fail(new Error(`ffmpeg exited ${code}\n${diagnostic}`)));
  });
}

function relativeFrame(path) {
  return `file '${basename(path).replaceAll("'", "'\\''")}'`;
}

async function open({ wide = false, clip = '' }, scale) {
  const viewport = wide ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error('Page error:', error));
  await page.goto(`${local}/?${wide ? 'wide=1&' : ''}${clip ? 'clip=' + clip : ''}`);
  await page.waitForFunction(() => window.prism?.ready);
  const session = await context.newCDPSession(page);
  return { context, page, session };
}

async function capture(page, session, time, path) {
  await page.evaluate(async (time) => {
    window.prism.paint(time);
    await Promise.all([...document.images].filter((image) => !image.complete).map((image) => image.decode().catch(() => {})));
  }, time);
  const { data } = await session.send('Page.captureScreenshot', { format: 'jpeg', quality: 86, optimizeForSpeed: true });
  await writeFile(path, Buffer.from(data, 'base64'));
}

async function renderChapter(page, session, chapter, variant, scale) {
  const destination = join(cache, variant, chapter.id);
  await mkdir(destination, { recursive: true });
  const video = join(destination, 'video.mp4');
  if (await stat(video).then((entry) => entry.size > 0, () => false)) return video;
  const manifest = ['ffconcat version 1.0'];
  const { frames } = chapter;
  const end = frames.at(-1);
  for (let i = 0; i < frames.length - 1; i++) {
    const frame = frames[i];
    const still = join(destination, `${String(frame).padStart(4, '0')}.jpg`);
    await capture(page, session, chapter.start + frame / 30 + .00003, still);
    manifest.push(relativeFrame(still), 'option framerate 30', `duration ${((frames[i + 1] - frame) / 30).toFixed(7)}`);
  }
  manifest.push(relativeFrame(join(destination, `${String(frames.at(-2)).padStart(4, '0')}.jpg`)), 'option framerate 30');
  const input = join(destination, 'frames.ffconcat');
  await writeFile(input, manifest.join('\n') + '\n');
  const filters = scale === 1 ? 'fps=30,format=yuv420p' : 'fps=30,scale=720:1280:flags=lanczos,format=yuv420p';
  const partial = join(destination, 'video.partial.mp4');
  await run(['-f', 'concat', '-safe', '0', '-i', input, '-an', '-vf', filters, '-frames:v', String(end),
    '-c:v', 'libx264', '-threads', '2', '-preset', 'superfast', '-crf', scale === 1 ? '20' : '22',
    '-g', '60', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-video_track_timescale', '30000', partial]);
  await rename(partial, video);
  console.log(`Rendered ${variant} / ${chapter.id} (${(end / 30).toFixed(1)} s)`);
  return video;
}

async function mux(videos, audio, target, duration) {
  const list = join(cache, `mux-${basename(target)}.ffconcat`);
  const paths = videos.map((path) => `file '${path.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`);
  await writeFile(list, ['ffconcat version 1.0', ...paths].join('\n') + '\n');
  await run(['-f', 'concat', '-safe', '0', '-i', list, '-i', audio, '-t', String(duration), '-c:v', 'copy',
    '-c:a', 'copy', '-map', '0:v:0', '-map', '1:a:0', '-movflags', '+faststart', target]);
  console.log(`Exported ${target}`);
}

async function renderMain(wide) {
  const { context, page, session } = await open({ wide }, 1);
  try {
    const info = await page.evaluate(() => ({ chapters: window.prism.plan, seconds: window.prism.seconds }));
    const videos = [];
    for (const chapter of info.chapters) {
      videos.push(await renderChapter(page, session, chapter, wide ? 'landscape' : 'vertical', 1));
    }
    const target = join(output, wide ? 'PRISM-Field-Guide-16x9.mp4' : 'PRISM-Field-Guide-9x16.mp4');
    await mux(videos, join(root, 'assets', 'main-mix.m4a'), target, info.seconds);
  } finally {
    await context.close();
  }
}

async function renderClips() {
  const folder = join(output, 'clips');
  await mkdir(folder, { recursive: true });
  for (const [i, scene] of scenes.entries()) {
    const scale = 2 / 3;
    const { context, page, session } = await open({ clip: scene.id }, scale);
    try {
      const chapter = await page.evaluate(() => window.prism.plan[0]);
      const video = await renderChapter(page, session, chapter, 'clips', scale);
      const target = join(folder, `${String(i + 1).padStart(2, '0')}-PRISM-${scene.id}.mp4`);
      await mux([video], join(root, 'assets', 'clip-mixes', `${scene.id}.m4a`), target, chapter.seconds);
    } finally {
      await context.close();
    }
  }
}

async function review(wide) {
  const folder = join(cache, wide ? 'review-wide' : 'review-vertical');
  await mkdir(folder, { recursive: true });
  const { context, page, session } = await open({ wide }, .5);
  try {
    const chapters = await page.evaluate(() => window.prism.plan);
    const overflows = [];
    for (const [i, chapter] of chapters.entries()) {
      await capture(page, session, chapter.start + chapter.seconds * .36, join(folder, `${String(i + 1).padStart(2, '0')}-${chapter.id}.jpg`));
      for (let t = .5; t < chapter.seconds; t += .75) {
        const overflow = await page.evaluate((time) => {
          window.prism.paint(time);
          const panel = document.querySelector('.screen');
          if (!panel.getBoundingClientRect().width) return '';
          const ui = panel.querySelector('.ui-body');
          const target = panel.querySelector('[data-tap]');
          const outer = panel.getBoundingClientRect();
          const control = target?.getBoundingClientRect();
          if (control && (control.bottom > outer.bottom - 7 || control.right > outer.right - 3)) return target.textContent;
          if (ui && ui.scrollHeight > ui.clientHeight + 3) return ui.innerText.slice(0, 85);
          return '';
        }, chapter.start + t);
        if (overflow) overflows.push({ chapter: chapter.id, t, overflow });
      }
    }
    console.log(`QA ${wide ? 'wide' : 'vertical'}`, JSON.stringify(overflows), folder);
  } finally {
    await context.close();
  }
}

try {
  await mkdir(output, { recursive: true });
  if (mode === 'review') await Promise.all([review(false), review(true)]);
  else {
    const tasks = mode === 'render' ? [renderMain(false), renderMain(true), renderClips()]
      : mode === 'clips' ? [renderClips()] : [renderMain(mode === 'wide')];
    const outcomes = await Promise.allSettled(tasks);
    for (const outcome of outcomes) if (outcome.status === 'rejected') throw outcome.reason;
  }
} finally {
  await browser.close();
  server.close();
}
