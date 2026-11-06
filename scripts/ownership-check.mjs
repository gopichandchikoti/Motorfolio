import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
await context.addInitScript({ path: 'node_modules/axe-core/axe.min.js' });
const page = await context.newPage();
const evidence = [];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const base = 'http://127.0.0.1:5181';
const receipt = {
  name: 'fixture-receipt.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\nQA fixture'),
};
async function check(name, work) {
  await work();
  evidence.push({ name, result: 'pass' });
}
async function state() {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('private-workspace-v1', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('snapshots');
          const get = tx.objectStore('snapshots').get('state');
          get.onsuccess = () => resolve(get.result.value);
          tx.oncomplete = () => db.close();
        };
      }),
  );
}
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Explore a clearly labeled demo garage/ }).click();
  await page.getByText('Demo garage.', { exact: true }).waitFor();
  await check('service receipt import, actual file download and category filtering', async () => {
    await page.getByRole('link', { name: 'Fuel & expenses', exact: true }).click();
    await page.getByRole('button', { name: 'Log activity', exact: true }).click();
    await page.getByLabel('Activity type', { exact: true }).selectOption('service');
    await page.getByLabel('Description', { exact: true }).fill('QA brake inspection');
    await page.getByLabel('Category', { exact: true }).selectOption('Brakes');
    await page.getByLabel('Receipt (image or PDF, up to 3 MB)', { exact: true }).setInputFiles(receipt);
    await page.getByRole('button', { name: 'Save record', exact: true }).click();
    await page.getByText('QA brake inspection', { exact: true }).waitFor();
    await page.getByLabel('Filter category', { exact: true }).selectOption('Brakes');
    assert.equal(await page.locator('tbody tr').count(), 1);
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download receipt', exact: true }).click();
    assert.equal((await downloaded).suggestedFilename(), receipt.name);
    assert.ok((await state()).entries.find((item) => item.title === 'QA brake inspection').receipt);
  });
  await check('structured warranty receipt, relaunch and encrypted backup/restore', async () => {
    await page.getByRole('link', { name: 'Warranties', exact: true }).click();
    await page.getByRole('button', { name: 'Add warranty', exact: true }).click();
    await page.getByLabel('Coverage name', { exact: true }).fill('QA battery coverage');
    await page.getByLabel('Provider', { exact: true }).fill('Fixture supplier');
    await page.getByLabel('Coverage ends (optional)', { exact: true }).fill('2099-01-01');
    await page.getByLabel('Odometer limit (0 = no recorded limit)', { exact: true }).fill('50000');
    await page.getByLabel('Warranty receipt (image or PDF, up to 3 MB)', { exact: true }).setInputFiles(receipt);
    await page.getByRole('button', { name: 'Save record', exact: true }).click();
    await page.getByText('QA battery coverage', { exact: true }).waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Download warranty receipt', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Settings & data', exact: true }).click();
    await page.getByRole('button', { name: 'Encrypted backup', exact: true }).click();
    await page.getByLabel('Backup password (at least 10 characters)', { exact: true }).fill('QA export password');
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Encrypt & download', exact: true }).click();
    const file = await downloaded;
    const backup = readFileSync(await file.path());
    assert.ok(!backup.toString().includes('QA battery coverage'));
    await page.getByRole('button', { name: 'Import / restore', exact: true }).click();
    await page
      .getByLabel('Backup or CSV file', { exact: true })
      .setInputFiles({ name: 'qa.backup', mimeType: 'application/json', buffer: backup });
    await page.getByLabel('Password (encrypted backup only)', { exact: true }).fill('QA export password');
    await page.getByRole('button', { name: 'Review import', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm change', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.ok((await state()).warranties[0].receipt.startsWith('data:application/pdf'));
  });
  await check('distance conversion preserves all histories and survives relaunch', async () => {
    const before = await state();
    await page.getByLabel('Distance units for The daily driver', { exact: true }).selectOption('km');
    assert.equal((await state()).vehicles[0].unit, 'mi');
    await page.getByRole('button', { name: 'Confirm change', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.reload({ waitUntil: 'networkidle' });
    const converted = await state();
    const id = before.vehicles[0].id;
    assert.equal(converted.vehicles.find((item) => item.id === id).unit, 'km');
    assert.ok(Math.abs(converted.entries[0].odometer - before.entries[0].odometer * 1.609344) < 1e-6);
    assert.equal(converted.warranties[0].expiresOdometer, 50000 * 1.609344);
  });
  await check('mileage-only reminder, keyboard dialog cancellation and skip navigation', async () => {
    await page.getByRole('link', { name: 'Maintenance', exact: true }).click();
    await page.getByRole('button', { name: 'Add reminder', exact: true }).click();
    await page.getByLabel('Service / reminder', { exact: true }).fill('Mileage QA');
    await page.getByLabel('Due date (optional for mileage reminders)', { exact: true }).fill('');
    await page.getByLabel('Due odometer (0 = date only)', { exact: true }).fill('90000');
    await page.getByRole('button', { name: 'Save record', exact: true }).click();
    await page.getByText('Mileage QA', { exact: true }).waitFor();
    assert.equal((await state()).schedules.at(-1).dueDate, '');
    await page.getByRole('button', { name: 'Add reminder', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('link', { name: 'Skip to content', exact: true }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'content');
    assert.ok(page.url().endsWith('#maintenance'));
  });
  const screens = [
    'Overview',
    'My garage',
    'Fuel & expenses',
    'Maintenance',
    'Warranties',
    'Trips & odometer',
    'Reports',
    'Settings & data',
  ];
  await check('all eight screens pass automated accessibility scans in both themes', async () => {
    const results = [];
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: 'Dark appearance', exact: true }).click();
      for (const name of screens) {
        await page.getByRole('link', { name, exact: true }).click();
        const result = await page.evaluate(() =>
          window.axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
          }),
        );
        results.push({ theme, screen: name, violations: result.violations });
      }
    }
    writeFileSync('qa/accessibility-all-screens.json', JSON.stringify(results, null, 2));
    assert.equal(
      results.reduce((sum, item) => sum + item.violations.length, 0),
      0,
      JSON.stringify(results.filter((item) => item.violations.length)),
    );
  });
  await check('portrait, landscape and narrow layouts across every screen', async () => {
    for (const viewport of [
      { width: 320, height: 900 },
      { width: 900, height: 420 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      for (const name of screens) {
        await page.getByRole('link', { name, exact: true }).click();
        const size = await page.evaluate(() => ({
          width: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        assert.ok(size.scroll <= size.width, `${name} ${JSON.stringify(viewport)} ${JSON.stringify(size)}`);
      }
    }
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.getByRole('link', { name: 'Warranties', exact: true }).click();
    await page.screenshot({ path: 'qa/warranties.png', fullPage: true });
  });
  await check('offline records, receipt and warranty remain usable', async () => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('QA battery coverage', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit warranty QA battery coverage', exact: true }).click();
    await page.getByLabel('Coverage terms / exclusions (optional)', { exact: true }).fill('Offline update');
    await page.getByRole('button', { name: 'Save record', exact: true }).click();
    await page.getByText('Offline update', { exact: true }).waitFor();
    await context.setOffline(false);
  });
  assert.deepEqual(errors, []);
} catch (error) {
  await page.screenshot({ path: 'qa/ownership-failure.png', fullPage: true }).catch(() => undefined);
  evidence.push({ name: 'failure', result: 'fail', detail: String(error) });
  throw error;
} finally {
  writeFileSync(
    'qa/ownership-check.json',
    JSON.stringify({ at: new Date().toISOString(), evidence, pageErrors: errors }, null, 2),
  );
  await browser.close();
}
process.stdout.write(JSON.stringify(evidence, null, 2) + '\n');
