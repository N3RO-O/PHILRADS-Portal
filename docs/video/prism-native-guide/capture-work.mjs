export async function capture({ page, context, go, shot }) {
  const button = (name) => page.getByRole('button', { name }).filter({ visible: true }).first();
  const text = (name) => page.getByText(name, { exact: typeof name === 'string' }).filter({ visible: true }).first();
  const press = async (locator) => {
    if (await locator.isVisible()) await locator.click({ timeout: 1600 }).catch(() => {});
  };
  const fixture = {
    id: 'video-activity', year: 2026, startDate: '2026-11-05', endDate: null, dateLabel: 'November 5, 2026',
    program: 'emergency', response: 'Sample response', activity: 'Relief pack handover', site: 'Sample field hub',
    lat: 14.623, lng: 121.032, geoPrecision: 'town', householdsTarget: null, individualsTarget: null,
    householdsServed: 30, individualsServed: 120, male: null, female: null, servedNote: null,
    funding: null, fundingNote: null, donors: null, partner: null, contactPerson: null, status: 'completed',
    source: 'Sample', notes: null,
  };
  await context.route('**/src/data/programActivities.local.json*', (route) => route.fulfill({
    contentType: 'application/javascript', body: `export default ${JSON.stringify([fixture])};`,
  }));
  await context.route('**/src/services/projects/projectsService.ts*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(/donor:\s*"(?:Relief Foundation|Community Grants Fund)"/g, 'donor: null')
      .replace(/totalCost:\s*(?:1850000|420000)\b/g, 'totalCost: null');
    await route.fulfill({ response, body });
  });
  await context.route(/^https:\/\/drive\.google\.com\/file\/d\/.+\/preview/, (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><meta name="viewport" content="width=device-width"><style>body{margin:0;background:#e5e2de;padding:24px;font:15px/1.6 Arial;color:#252022}article{background:white;padding:24px;border:1px solid #c9c2bb}header{color:#8c1414;font-weight:700;letter-spacing:2px}p{border-bottom:1px solid #bbb;padding-bottom:12px}</style><article><header>PHILRADS · SAMPLE FORM</header><h1>Relief distribution acknowledgement</h1><p>Activity: Sample relief pack handover</p><p>Site: Sample field hub</p><p>Prepared by: Demo User</p><p>Signature:</p></article>`,
  }));
  if (!process.env.PRISM_WORK_ONLY) {
  await go('/forms');
  const report = text('Activity Report');
  await shot('forms-1', { target: report, cue: 'Open Activity Report' });
  await press(report);
  if (!page.url().includes('activity-report')) await go('/forms/activity-report');
  const input = page.locator('.ff').filter({ visible: true }).first();
  if (await input.count()) await input.fill('Sample relief pack handover').catch(() => {});
  await shot('forms-1', { at: .53, target: input, cue: 'Fill in a field' });
  const font = page.getByRole('group', { name: 'Text size' });
  const larger = font.getByRole('button').last();
  await shot('forms-2', { target: font, cue: 'Adjust text size' });
  await press(larger);
  await shot('forms-2', { at: .52, target: font, cue: 'Set a readable size' });
  const sign = button('Sign here');
  await shot('forms-3', { target: sign, cue: 'Tap a signature line' });
  await press(sign);
  const canvas = page.locator('canvas').filter({ visible: true }).last();
  const box = await canvas.boundingBox().catch(() => null);
  if (box) {
    await page.mouse.move(box.x + box.width * .18, box.y + box.height * .70);
    await page.mouse.down();
    for (const [x, y] of [[.23, .42], [.32, .64], [.39, .37], [.44, .55], [.54, .41], [.61, .62], [.74, .45]]) {
      await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 4 });
    }
    await page.mouse.up();
  }
  await shot('forms-3', { at: .45, target: canvas, cue: 'Sign on screen' });
  await press(button(/use signature|save signature|^save$|^done$/i));
  await press(button(/^close$/i));
  const print = button(/Print \/ Save as PDF/i);
  await shot('forms-4', { target: print, cue: 'Print / Save as PDF' });
  await press(print);
  await shot('forms-4', { at: .57, cue: 'Use the form’s paper size' });
  }

  await go('/projects');
  const project = page.getByRole('link').filter({ hasText: /Relief|Training|Livelihood|Recovery/i }).filter({ visible: true }).last();
  const detailButton = button(/View project|Open project|See project/i);
  const visibleProject = (await detailButton.isVisible()) ? detailButton : project;
  await shot('projects-resources-statistics-1', { target: visibleProject, cue: 'Open a project' });
  await press(visibleProject);
  if (!page.url().includes('/projects')) await go('/projects');
  await shot('projects-resources-statistics-1', { at: .47, target: text(/Milestones|Project tasks|Team/i), cue: 'Find milestones, team and tasks' });
  await go('/resources');
  const preview = button(/^Preview$/i);
  await shot('projects-resources-statistics-2', { target: preview, cue: 'Preview a resource' });
  await press(preview);
  await shot('projects-resources-statistics-2', { at: .51, cue: 'Read the preview in PRISM' });
  await go('/resources');
  const options = button(/^More for /i);
  await options.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' })).catch(() => {});
  await press(options);
  await shot('projects-resources-statistics-3', { target: text('Copy link'), cue: 'Open the resource’s action menu' });
  await go('/statistics');
  await shot('projects-resources-statistics-4', { target: text(/Projects and activities since/i), cue: 'Browse Statistics' });
  const activity = text('Relief pack handover');
  await shot('projects-resources-statistics-4', { at: .48, target: activity, cue: 'See who was served' });
  await press(activity);
  await shot('projects-resources-statistics-4', { at: .73, target: button(/show on map|show on live map/i), cue: 'Find the activity on Live Map' });
}
