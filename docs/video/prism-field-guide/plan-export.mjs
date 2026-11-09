import { writeFileSync } from 'node:fs';
import { scenes } from './scenes.mjs';
import { getBeats, videoPlan } from './plan.mjs';

const voices = new Map();
for (const scene of scenes) {
  for (const short of [false, true]) {
    for (const { id, speech } of getBeats(scene, short)) voices.set(id, speech);
  }
}
const strip = ({ seconds, chapters }) => ({ seconds, chapters: chapters.map(({ id, start, beats }) =>
  ({ id, start, beats: beats.map(({ id, speech, seconds, start, effect }) => ({ id, speech, seconds, start, effect })) })) });
writeFileSync(process.argv[2], JSON.stringify({ voices: [...voices], main: strip(videoPlan()),
  clips: Object.fromEntries(scenes.map(({ id }) => [id, strip(videoPlan(true, id))])) }, null, 2));
