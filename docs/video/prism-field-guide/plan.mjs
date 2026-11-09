import { scenes } from './scenes.mjs';

export const mainScenes = scenes.filter((scene) => scene.id !== 'admin');
const taskShort = [
  'Open Mine, Given or Team. Tasks follow the six PHILRADS programs.',
  'In Today, tap Accept to take the request, or Decline.',
  'Tap Start. Check off each step.',
  'Swipe right to finish, or left to plan for Today.',
  'Add a note or link. Take a photo when required.',
  'Tap Finish and send. An optional photo earns five XP.',
  'If the giver sends it back, read their note.',
  'Tap New task. Choose who, when, a list and a priority.',
  'Finish one task each workday for twenty-five XP.',
];

export function getBeats(scene, short = false) {
  const raw = short && scene.shortBeats ? scene.shortBeats : scene.beats;
  const duration = raw.reduce((sum, beat) => sum + beat.seconds, 0);
  const scale = short ? scene.shortSeconds / duration : 1;
  let start = 0;
  let elapsed = 0;
  return raw.map((beat, i) => {
    elapsed += beat.seconds;
    const end = Math.round(elapsed * scale * 30) / 30;
    const seconds = end - start;
    const custom = short && scene.id === 'staff-tasks';
    const id = `${scene.id}-${i + 1}${custom || (short && scene.shortBeats && scene.beats[i] !== beat) ? '-short' : ''}`;
    const speech = custom ? taskShort[i] : beat.speech;
    const result = { ...beat, id, speech, seconds, start };
    start = end;
    return result;
  });
}

export function videoPlan(short = false, onlyScene = '') {
  let start = 0;
  const chapters = (onlyScene ? scenes.filter((scene) => scene.id === onlyScene) : mainScenes)
    .map((scene) => {
      const beats = getBeats(scene, short);
      const seconds = beats.reduce((sum, beat) => sum + beat.seconds, 0);
      const result = { ...scene, start, seconds, beats };
      start += seconds;
      return result;
    });
  return { seconds: start, chapters };
}

