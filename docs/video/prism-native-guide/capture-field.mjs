import { join } from 'node:path';

async function center(locator) {
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  await locator.evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
}

async function firstOption(select, index = 1) {
  await select.locator('option').nth(index).waitFor({ state: 'attached' });
  return select.selectOption({ index });
}

export async function capture({ page, context, go, shot, repo }) {
  const open = (path) => go('http://127.0.0.1:4187' + path);
  await context.addInitScript(() => {
    localStorage.setItem('philrads.demo.role', 'coordinator');
    localStorage.setItem('philrads.theme', 'dark');
  });
  await context.route('**/src/services/documentation/documentationService.ts*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replaceAll('info.philrads@gmail.com', 'training@example.invalid')
      .replaceAll('1gXtyek05YP_57rsPYzRIUcqpCCg1N-_l', 'training-folder');
    await route.fulfill({ response, body });
  });

  await open('/inventory');
  const stock = page.getByRole('tab', { name: 'Stock', exact: true });
  const search = page.locator('#inv-search');
  await center(search);
  await shot('inventory-1', { at: 0, target: search, cue: 'Search stock' });
  await search.fill('Hygiene kit');
  const category = page.getByLabel('Category', { exact: true });
  await category.selectOption({ label: 'Hygiene' });
  await page.waitForTimeout(275);
  await shot('inventory-1', { at: 0.46, target: category, cue: 'Filter by category' });
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await category.selectOption({ value: '' });
  await page.waitForTimeout(300);

  const low = page.getByRole('button').filter({ has: page.getByText('Low stock', { exact: true }) }).first();
  await center(low);
  await shot('inventory-2', { at: 0, target: low.getByText('Low stock', { exact: true }), cue: 'Find the Low stock badge' });
  await low.click();
  const itemDetail = page.getByRole('dialog').filter({ visible: true });
  await itemDetail.waitFor();
  await shot('inventory-2', { at: 0.5, target: itemDetail.getByRole('heading').first(), cue: 'Open the stock card' });
  await itemDetail.getByRole('button', { name: 'Close', exact: true }).click();

  const activity = page.getByRole('tab', { name: 'Activity log', exact: true });
  await center(activity);
  await shot('inventory-3', { at: 0, target: activity, cue: 'Open Activity' });
  await activity.click();
  const movement = page.getByRole('group', { name: 'Movement type', exact: true });
  await center(movement);
  await shot('inventory-3', { at: 0.37, target: movement, cue: 'Browse stock movements' });
  await stock.click();
  const exportButton = page.getByRole('button', { name: 'Export', exact: true });
  await center(exportButton);
  await shot('inventory-4', { at: 0, target: exportButton, cue: 'Tap Export' });
  await exportButton.click();
  await shot('inventory-4', { at: 0.36, target: page.getByRole('menu'), cue: 'Choose CSV or printable report' });

  await open('/response');
  const newEvent = page.getByRole('button', { name: 'New event', exact: true }).first();
  await center(newEvent);
  await shot('response-1', { at: 0, target: newEvent, cue: 'Open Response' });
  await newEvent.click();
  const event = page.getByRole('dialog', { name: 'New relief event' });
  const name = event.getByLabel('Event name');
  await name.waitFor();
  await shot('response-2', { at: 0, target: name, cue: 'Enter event details' });
  await name.fill('Sampaguita relief outreach');
  await event.getByLabel('Location', { exact: true }).fill('Sampaguita Field Hub');
  await event.getByLabel('Target beneficiaries').fill('120');
  const ims = event.getByRole('button', { name: 'Create in PHILRADS IMS' });
  await center(ims);
  await shot('response-2', { at: 0.6, target: ims, cue: 'Continue in PHILRADS IMS' });

  await open('/live-map');
  const places = page.getByRole('button', { name: /^List\b/ });
  await center(places);
  await shot('response-3', { at: 0, target: places, cue: 'Find the response on Live Map' });
  await places.click();
  const linkedSite = page.getByRole('button', { name: /Sagkahan Distribution Point/ }).last();
  await center(linkedSite);
  await shot('response-3', { at: 0.42, target: linkedSite, cue: 'Open a sample distribution site' });
  await linkedSite.click();
  const siteSheet = page.getByRole('dialog').filter({ visible: true });
  await siteSheet.waitFor();
  await shot('response-3', { at: 0.72, target: siteSheet.getByRole('heading').first(), cue: 'See the linked relief event' });

  await open('/documentation');
  const upload = page.getByRole('button', { name: 'Upload', exact: true }).filter({ visible: true });
  await upload.waitFor();
  await shot('documentation-1', { at: 0, target: upload, cue: 'Tap Upload' });
  await upload.click();
  const sheet = page.getByRole('dialog', { name: 'Upload documentation' });
  const choosePhotos = sheet.getByRole('button', { name: /Choose photos/ });
  await choosePhotos.waitFor();
  await shot('documentation-1', { at: 0.42, target: choosePhotos, cue: 'Choose the file type' });
  const sample = join(repo, 'docs/video/prism-field-guide/assets/sign-in-field.jpg');
  const { readFile } = await import('node:fs/promises');
  await sheet.locator('input[type=file]').setInputFiles({ name: 'Sample distribution photo.jpg', mimeType: 'image/jpeg', buffer: await readFile(sample) });
  const project = sheet.getByLabel('For which project?');
  const response = sheet.getByLabel('For which response?');
  await firstOption(response);
  await firstOption(project);
  await center(project);
  await shot('documentation-2', { at: 0, target: project, cue: 'Link the file to a project or response' });
  const send = sheet.getByRole('button', { name: /Upload 1 file/ });
  await shot('documentation-2', { at: 0.68, target: send, cue: 'Upload the selected file' });
  await send.click();

  const complete = page.getByText(/Uploaded Sample distribution photo/i).filter({ visible: true });
  await page.waitForTimeout(1300);
  const drive = page.getByRole('region', { name: 'Google Drive', exact: true });
  await center(drive);
  await shot('documentation-3', { at: 0, target: await complete.count() ? complete.first() : drive, cue: 'PRISM records the upload' });
  const uploaded = page.getByText('Sample distribution photo', { exact: true }).filter({ visible: true }).first();
  await center(uploaded);
  await shot('documentation-3', { at: 0.52, target: uploaded, cue: 'Find the saved documentation' });

  const media = page.getByRole('tab', { name: /^Media\b/ });
  await center(media);
  await shot('documentation-4', { at: 0, target: media, cue: 'Open Media' });
  await media.click();
  const records = page.getByRole('tab', { name: /^Records\b/ });
  await shot('documentation-4', { at: 0.4, target: records, cue: 'Switch to Records' });
  await records.click();
  await shot('documentation-4', { at: 0.72, target: records, cue: 'Browse records by type' });
}
