import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const output = join(process.argv[2], 'plan.json');
const source = fileURLToPath(new URL('../prism-field-guide/plan-export.mjs', import.meta.url));
execFileSync(process.execPath, [source, output]);
const plan = JSON.parse(readFileSync(output, 'utf8'));
const lines = {
  'sign-in-2': 'The first tap starts the theme. Tap the speaker to mute it.',
  'staff-tasks-2': 'In Today, open the request. Tap Accept to take it, or Can’t take it to decline.',
  'staff-tasks-2-short': 'In Today, tap Accept or Can’t take it.',
};
for (const voice of plan.voices) if (lines[voice[0]]) voice[1] = lines[voice[0]];
for (const cut of [plan.main, ...Object.values(plan.clips)]) {
  for (const chapter of cut.chapters) {
    for (const beat of chapter.beats) if (lines[beat.id]) beat.speech = lines[beat.id];
  }
}
writeFileSync(output, JSON.stringify(plan, null, 2));
