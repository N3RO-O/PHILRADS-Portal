import { readFileSync, writeFileSync } from 'node:fs';
import { scenes } from '../prism-field-guide/scenes.mjs';
import { videoPlan } from '../prism-field-guide/plan.mjs';

const read = (relative) => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'));
let captions;
try { captions = read('./audio/captions.json'); } catch { captions = read('../prism-field-guide/assets/captions.json'); }
const shots = new Map();
for (const group of ['core', 'home', 'field', 'work']) {
  let items;
  try { items = read(`./capture/${group}/shots.json`); } catch { continue; }
  for (const item of items) {
    if (item.cue === 'Accept or Decline') item.cue = 'Accept or Can’t take it';
    if (!shots.has(item.id)) shots.set(item.id, []);
    shots.get(item.id).push(item);
  }
}
const missing = new Set();
function prepare(plan, cut) {
  return {
    seconds: plan.seconds,
    chapters: plan.chapters.map(({ id, title, context, seconds, start, beats }) => ({
      id, title, context, seconds, start,
      beats: beats.map((beat) => {
        const key = beat.id;
        let footage = shots.get(key) ?? shots.get(key.replace(/-short$/, ''));
        if (!footage && beat.effect !== 'prism' && key === 'opening-2-short') footage = shots.get('home-2');
        if (!footage && beat.effect !== 'prism') missing.add(key);
        return {
          id: key, start: beat.start, seconds: beat.seconds, cue: beat.cue, brand: beat.effect === 'prism',
          shots: (footage ?? []).slice().sort((a, b) => a.at - b.at),
          captions: captions[cut][key],
        };
      }),
    })),
  };
}
const plan = { main: prepare(videoPlan(), 'main'),
  clips: Object.fromEntries(scenes.map(({ id }) => [id, prepare(videoPlan(true, id), id)])) };
writeFileSync(new URL('native-plan.json', import.meta.url), JSON.stringify(plan, null, 2));
if (missing.size) console.log('Missing capture beats:', [...missing].join(', '));
else console.log('Capture coverage complete.');
