import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, LEGACY_KEY, LEGACY_STATE, openApp, tab, trackErrors } from './helpers';

test('all tabs work, the tab bar stays fixed at the bottom, nothing overflows', async ({ page }) => {
  const errors = trackErrors(page);
  await openApp(page);
  await expect(page.getByRole('heading', { name: 'Physio & Knie-Stabilität' })).toBeVisible();
  for (const [name, heading] of [['Training', 'Training'], ['Kalender', 'Kalender'], ['Physio', 'Physio'], ['Fortschritt', 'Fortschritt'], ['Heute', 'HYROX.']] as const) {
    await tab(page, name).click();
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(heading, { ignoreCase: true });
    const bar = await page.getByRole('navigation', { name: 'Hauptnavigation' }).boundingBox();
    const viewport = page.viewportSize()!;
    expect(bar!.y + bar!.height).toBeCloseTo(viewport.height, 0);
    expect(bar!.x).toBeGreaterThanOrEqual(0);
    await expect(tab(page, name)).toHaveAttribute('aria-current', 'page');
    await expectNoHorizontalOverflow(page);
  }
  for (const hash of ['#/einstellungen', '#/daten', '#/uebungen', '#/knie', '#/uebung/hyrox-sled-push']) {
    await page.goto(`./${hash}`);
    await expect(page.locator('main h1')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  expect(errors).toEqual([]);
});

test('a planned workout is started, logged, finished and still there after reloading', async ({ page }) => {
  const errors = trackErrors(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Training starten' }).click();
  await expect(page.getByRole('button', { name: /Physio & Knie-Stabilität – umbenennen/ })).toBeVisible();
  await page.getByRole('radiogroup', { name: 'Knieschmerz vor dem Training' }).getByRole('radio', { name: '2 von 10' }).click();
  await page.getByRole('link', { name: /Spanish Squat/ }).click();
  await page.getByLabel('Sekunden Satz 1').fill('25');
  await page.getByRole('button', { name: 'Satz 1 abhaken' }).click();
  await expect(page.getByRole('button', { name: 'Satz 1 nicht mehr abhaken' })).toBeVisible();
  await page.getByRole('link', { name: 'Übersicht' }).click();
  await page.getByRole('button', { name: 'Training abschließen' }).click();
  await page.getByRole('radiogroup', { name: 'Knieschmerz nach dem Training' }).getByRole('radio', { name: '3 von 10' }).click();
  await page.getByRole('radiogroup', { name: 'Belastung' }).getByRole('radio', { name: '6' }).click();
  await page.getByRole('button', { name: 'Abschließen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Stark gemacht!' })).toBeVisible();
  await expect(page.getByText('+40 XP')).toBeVisible();
  await expect(page.getByText('2 → 3')).toBeVisible();

  await page.reload();
  await page.goto('./#/verlauf');
  await page.getByRole('link', { name: /Physio & Knie-Stabilität/ }).click();
  await expect(page.getByRole('cell', { name: '25' })).toBeVisible();
  await expect(page.getByText('Abgeschlossen')).toBeVisible();
  await tab(page, 'Kalender').click();
  await expect(page.getByText('Erledigt').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('data of the previous version is taken over once and left untouched', async ({ page }) => {
  await openApp(page);
  const raw = JSON.stringify(LEGACY_STATE);
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [LEGACY_KEY, raw]);
  await page.reload();
  await expect(page.getByText('Deine Daten sind übernommen')).toBeVisible();
  await page.goto('./#/verlauf');
  await expect(page.getByRole('link', { name: /Kraft & Ausdauer/ })).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), LEGACY_KEY)).toBe(raw);
  await page.goto('./#/einstellungen');
  await expect(page.getByLabel('Partner oder Partnerin (optional)')).toHaveValue('Alex');
});

test('backup: export, delete everything, import again; broken files are rejected', async ({ page }, info) => {
  const errors = trackErrors(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Knie-Check' }).first().click();
  await page.getByRole('radio', { name: '1 von 10' }).click();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await page.goto('./#/daten');
  await expect(page.locator('.stat').filter({ hasText: 'Kniewerte' })).toContainText('1');

  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'JSON-Backup herunterladen' }).click()]);
  const file = info.outputPath('backup.json');
  await json.saveAs(file);
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).format).toBe('hyrox-trainer-backup');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Trainings als CSV (Excel)' }).click()]);
  const csvFile = info.outputPath('t.csv');
  await csv.saveAs(csvFile);
  expect(fs.readFileSync(csvFile, 'utf8')).toContain('Datum;Training;Art');

  await page.getByRole('button', { name: 'Alle Trainingsdaten löschen' }).click();
  await page.getByLabel('Zum Bestätigen LÖSCHEN eintippen').fill('LÖSCHEN');
  await page.getByRole('button', { name: 'Endgültig löschen' }).click();
  await expect(page.getByText('Alle Trainingsdaten wurden gelöscht')).toBeVisible();
  await expect(page.locator('.stat').filter({ hasText: 'Kniewerte' })).toContainText('0');

  const broken = info.outputPath('broken.json');
  fs.writeFileSync(broken, '{"plans": "x"');
  await page.getByLabel('Backup-Datei auswählen').setInputFiles(broken);
  await expect(page.getByText('kein gültiges JSON')).toBeVisible();

  await page.getByLabel('Backup-Datei auswählen').setInputFiles(file);
  await page.getByRole('button', { name: 'Importieren' }).click();
  await expect(page.getByText('Import abgeschlossen')).toBeVisible();
  await expect(page.locator('.stat').filter({ hasText: 'Kniewerte' })).toContainText('1');
  await tab(page, 'Heute').click();
  await expect(page.getByRole('heading', { name: 'Physio & Knie-Stabilität' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('works offline after the first visit', async ({ page, context }) => {
  await openApp(page, '', null);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).some((k) => k.startsWith('hyrox-trainer-')))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
  await tab(page, 'Physio').click();
  await expect(page.getByRole('heading', { name: 'Physio', level: 1 })).toBeVisible();
  await context.setOffline(false);
});

test('football can be moved to Sunday; the app warns about two intensive days in a row', async ({ page }) => {
  await openApp(page, '#/kalender');
  await page.getByRole('button', { name: /^Donnerstag, 5\. November/ }).click();
  await page.getByRole('button', { name: 'Verschieben' }).click();
  await page.getByRole('button', { name: /^Sonntag · / }).click();
  await page.getByRole('button', { name: /^Sonntag, 8\. November/ }).click();
  await expect(page.getByText(/verschoben von/)).toBeVisible();
  await expect(page.getByText(/Fußball direkt neben einer intensiven Einheit/)).toBeVisible();
  await page.getByRole('button', { name: 'Auslassen' }).click();
  await expect(page.getByText(/Fußball direkt neben/)).toHaveCount(0);
  // A skipped occurrence is listed on its original day and comes back there.
  await page.getByRole('button', { name: /^Donnerstag, 5\. November/ }).click();
  await page.getByRole('button', { name: 'Wiederherstellen' }).click();
  await expect(page.getByRole('button', { name: 'Verschieben' })).toBeVisible();
  await expect(page.getByText(/Fußball direkt neben/)).toHaveCount(0);
});

test('knee check drives the traffic light; locked exercises need a confirmation', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Knie-Check' }).first().click();
  await page.getByRole('radio', { name: '6 von 10' }).click();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('.knee-card .light')).toHaveText('Rot');
  await expect(page.getByText('kniebelastende Übungen heute ersetzen')).toBeVisible();

  await tab(page, 'Physio').click();
  await page.getByRole('link', { name: /Sissy Squat/ }).click();
  await expect(page.getByText('Aktuell gesperrt').first()).toBeVisible();
  await page.getByRole('button', { name: 'Ändern' }).click();
  await page.getByLabel(/^Optional/).click();
  await expect(page.locator('.facts .chip').first()).toHaveText('Optional');

  await tab(page, 'Training').click();
  await page.getByRole('button', { name: 'Freies Training' }).click();
  await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
  await page.getByLabel('Übung suchen').fill('Lunge + Jump');
  await page.getByRole('button', { name: /Lunge \+ Jump/ }).click();
  await expect(page.getByRole('dialog', { name: 'Gesperrte Übung' })).toBeVisible();
  await page.getByRole('button', { name: 'Zurück zur Auswahl' }).click();
  await expect(page.getByRole('dialog', { name: 'Übung hinzufügen' })).toBeVisible();
});
