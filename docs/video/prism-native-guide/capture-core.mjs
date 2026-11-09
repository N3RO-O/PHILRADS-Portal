import { join } from 'node:path';

const signinPath = '/docs/video/prism-native-guide/capture-sign-in.html';
const title = 'Photograph the relief handover';
const fakeEmail = 'demo@example.invalid';
const sampleStore = 'philrads.sample.tasks.v1';

export async function capture({ page, context, go, shot, repo }) {
  // The actual SignInPage uses these isolated authentication responses during the capture.
  await context.route('**/src/components/auth/AuthProvider.tsx*', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({ response, body: body.replace('return ctx;', 'return { ...ctx, ...globalThis.__prismCaptureAuth };') });
  });
  await page.addInitScript(() => {
    if (new URLSearchParams(location.search).has('capture-ios')) {
      Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile Safari/605.1.15' });
    }
    if (!location.pathname.endsWith('capture-sign-in.html')) return;
    globalThis.__prismCaptureAuth = {
      signIn: async (_email, password) => password === 'demo-pass'
        ? (location.assign('/'), null) : 'Invalid login credentials',
      requestPasswordReset: async () => null,
      sendCode: async () => null,
      verifyCode: async () => (location.assign('/'), null),
    };
  });
  for (const [url, file, type] of [
    ['**/brand/sign-in-background.mp4', 'sign-in-field.mp4', 'video/mp4'],
    ['**/brand/sign-in-background.jpg', 'sign-in-field.jpg', 'image/jpeg'],
  ]) {
    await context.route(url, (route) => route.fulfill({
      path: join(repo, 'docs/video/prism-field-guide/assets', file), contentType: type,
    }));
  }
  const button = (name) => page.getByRole('button', { name, exact: typeof name === 'string' }).first();
  const text = (name) => page.getByText(name, { exact: typeof name === 'string' }).first();
  const click = async (locator) => { await locator.click({ timeout: 2200 }).catch(() => {}); };
  const fill = async (locator, value) => { if (await locator.isVisible()) await locator.fill(value, { timeout: 2000 }).catch(() => {}); };
  const clearOnboarding = async () => { await click(button('Skip for now')); };
  if (process.env.PRISM_SIGNIN_EXTRAS) {
    await go('/?capture-ios');
    await clearOnboarding();
    await click(button('Account menu'));
    await click(button('Install app'));
    await shot('sign-in-1', { cue: 'Add to Home Screen', target: text(/Add to Home screen/i) });
    await go('/profile');
    await click(button('Account menu'));
    await click(button(/Quick unlock/i));
    await shot('sign-in-7', { cue: 'Quick unlock', target: button('Set PIN') });
    await click(button('Set PIN'));
    await shot('sign-in-7', { at: .54, cue: 'Choose a 6-digit PIN', target: text('Choose a 6-digit PIN') });
    return;
  }

  if (!process.env.PRISM_TASK_ONLY) {
  await go('/?capture-ios');
  await clearOnboarding();
  await click(button('Account menu'));
  const install = button('Install app');
  await click(install);
  await shot('sign-in-1', { cue: 'Add to Home Screen', target: text(/Add to Home screen/i) });
  await go(signinPath);
  const speaker = button(/tap for music|turn off the PRISM theme|play the PRISM theme/i);
  await shot('sign-in-2', { cue: 'Tap for music', target: speaker });
  await click(speaker);
  await shot('sign-in-2', { at: .52, cue: 'Tap the speaker to mute', target: speaker });
  const email = page.getByLabel('Email', { exact: true }).first();
  const password = page.locator('input[autocomplete="current-password"]').first();
  await fill(email, fakeEmail);
  await fill(password, 'demo-wrong');
  const eye = button(/show password|hide password/i);
  await shot('sign-in-3', { cue: 'Enter your staff credentials', target: password });
  await click(eye);
  await shot('sign-in-3', { at: .36, cue: 'Show password', target: eye });
  await click(eye);
  await shot('sign-in-3', { at: .69, cue: 'Sign in', target: button('Sign in') });
  await click(button('Sign in'));
  await shot('sign-in-4', { cue: 'Check your password', target: text(/Invalid login credentials/i) });
  await click(button('Forgot your password?'));
  await shot('sign-in-4', { at: .52, cue: 'Email me a reset link', target: button('Email me a reset link') });
  await go(signinPath);
  const volunteer = button(/Volunteer.*Email code/i);
  await shot('sign-in-5', { cue: 'Volunteer · Email code', target: volunteer });
  await click(volunteer);
  await fill(email, fakeEmail);
  await shot('sign-in-5', { at: .51, cue: 'Email me a code', target: button('Email me a code') });
  await click(button('Email me a code'));
  const code = page.locator('input[autocomplete="one-time-code"]').first();
  await fill(code, '384216');
  await shot('sign-in-6', { cue: 'Enter the 6-digit code', target: button('Sign in') });
  await go(signinPath);
  const guest = page.getByRole('link', { name: /Guest.*Look around/i }).first();
  await shot('sign-in-6', { at: .65, cue: 'Guest · Look around', target: guest });
  await go('/');
  await click(button('Account menu'));
  await click(button(/Quick unlock/i));
  await shot('sign-in-7', { cue: 'Quick unlock', target: button('Set PIN') });
  await click(button('Set PIN'));
  await shot('sign-in-7', { at: .54, cue: 'Choose a 6-digit PIN', target: text('Choose a 6-digit PIN') });
  } else {
    await go('/');
  }

  await page.evaluate(({ title, sampleStore }) => {
    const now = new Date().toISOString();
    const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Manila' });
    const base = { notes: 'Get a wide photo of the sample handover.', list: 'emergency', setting: 'field',
      priority: 'high', status: 'todo', dueDate: day, dueTime: null, myDay: day,
      subtasks: [{ id: 'demo-s1', title: 'Check the distribution table', done: false },
        { id: 'demo-s2', title: 'Take a wide photo', done: false }],
      recurrence: 'none', location: 'Sample field hub', assigneeId: 'demo-user', assigneeName: 'Demo User',
      createdById: 'demo-maria', createdByName: 'Jori (demo)', projectId: null, requiresPhoto: true,
      acceptance: 'pending', completedAt: null, createdAt: now, updatedAt: now,
    };
    const tasks = [{ ...base, id: 'prism-training-task', title },
      { ...base, id: 'prism-training-given', title: 'Confirm the field kit count', assigneeId: 'demo-maria',
        assigneeName: 'Sample teammate', createdById: 'demo-user', createdByName: 'Demo User',
        acceptance: 'accepted', status: 'done', completedAt: now }];
    localStorage.setItem(sampleStore, JSON.stringify({ tasks, goal: 300, awards: [], kudos: [] }));
    localStorage.setItem('philrads.demo.role', 'coordinator');
  }, { title, sampleStore });
  await go('/tasks?view=myday');
  const mine = page.getByText('Mine', { exact: true }).filter({ visible: true }).first();
  await shot('staff-tasks-1', { cue: 'Mine · Given · Team', target: mine });
  await click(mine);
  await shot('staff-tasks-1', { at: .55, cue: 'Choose a task view', target: button('Today') });
  await click(button('Today'));
  const task = text(title);
  await shot('staff-tasks-2', { cue: 'Open a task request', target: task });
  await click(task);
  const accept = button('Accept');
  await shot('staff-tasks-2', { at: .49, cue: 'Accept or Can’t take it', target: accept });
  await click(accept);
  await page.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key));
    data.tasks[0].acceptance = 'accepted';
    localStorage.setItem(key, JSON.stringify(data));
  }, sampleStore);
  await go('/tasks?view=myday');
  const start = button('Start');
  await shot('staff-tasks-3', { cue: 'Start', target: start });
  await click(start);
  await click(task);
  const step = page.getByRole('checkbox', { name: 'Check the distribution table' }).first();
  await shot('staff-tasks-3', { at: .54, cue: 'Check off a step', target: step });
  await click(step);
  await click(button(/close/i));
  await go('/tasks?view=myday');
  const finish = button('Finish');
  await shot('staff-tasks-4', { cue: 'Finish', target: finish });
  await shot('staff-tasks-4', { at: .49, cue: 'Swipe a task row', target: task });
  await click(finish);
  const note = page.getByPlaceholder(/What was done/).first();
  await fill(note, 'Relief packs handed over. Wide photo attached.');
  await shot('staff-tasks-5', { cue: 'Add a note and photo', target: note });
  const addPhotos = button(/Add photos/i);
  await shot('staff-tasks-5', { at: .50, cue: 'Add photos', target: addPhotos });
  const image = await page.evaluate(async () => {
    const i = new Image();
    i.src = '/docs/video/prism-field-guide/assets/distribution.svg';
    await i.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 560;
    canvas.getContext('2d').drawImage(i, 0, 0, 900, 560);
    return canvas.toDataURL('image/jpeg').split(',')[1];
  });
  const input = page.locator('input[type="file"][accept*="image"]').last();
  if (await input.count()) await input.setInputFiles({ name: 'demo-handover.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(image, 'base64') });
  const send = button(/Finish and send|^Finish$/i);
  await shot('staff-tasks-6', { cue: 'Finish and send', target: send });
  await click(send);
  await shot('staff-tasks-6', { at: .65, cue: 'Photo proof attached' });
  await go('/tasks?view=team&task=prism-training-given');
  const sendBack = button(/Send it back/i);
  await shot('staff-tasks-7', { cue: 'Review work you assigned', target: sendBack });
  await click(sendBack);
  const reason = page.getByRole('textbox', { name: 'What still needs doing' });
  await fill(reason, 'Please include the hygiene kit count.');
  await shot('staff-tasks-7', { at: .46, cue: 'Say what still needs doing', target: reason });
  await go('/tasks');
  const newTask = button('New task');
  await shot('staff-tasks-8', { cue: 'New task', target: newTask });
  await click(newTask);
  await shot('staff-tasks-8', { at: .38, cue: 'Choose a person, due date, list and priority', target: page.getByLabel('Due date', { exact: true }).first() });
  await go('/tasks');
  await shot('staff-tasks-9', { cue: 'See your weekly progress', target: text(/Your week|Team goal|Streak/i) });
}
