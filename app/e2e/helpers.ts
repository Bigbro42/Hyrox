import { expect, type Page } from '@playwright/test';

/** A fixed Wednesday in week 2 of the plan: unit A (Physio) is planned, football on Thursday. */
export const TODAY = new Date('2026-11-04T09:00:00+01:00');

/** Collects uncaught errors and console errors of a page. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

export async function openApp(page: Page, hash = '', time: Date | null = TODAY) {
  if (time) await page.clock.setFixedTime(time);
  await page.goto(`./${hash}`);
  await expect(page.locator('.spinner')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
}

/** A tab of the bottom navigation; page content may contain links with the same name. */
export function tab(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name, exact: true });
}

/** Checks with the page's own fonts and with a wide fallback font. */
export async function expectNoHorizontalOverflow(page: Page) {
  const measure = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await measure(), 'horizontal overflow in px').toBeLessThanOrEqual(0);
  const style = await page.addStyleTag({ content: '* { font-family: Verdana, "DejaVu Sans", sans-serif !important; }' });
  expect(await measure(), 'horizontal overflow in px with a wide font').toBeLessThanOrEqual(0);
  await style.evaluate((el) => (el as Element).remove());
}

export const LEGACY_KEY = 'form-hyrox-trainer-v1';

export const LEGACY_STATE = {
  v: 1,
  plans: [{ id: 'P', name: 'Physio & Knie', kind: 'Physio', mins: 45, items: ['Radfahren locker', 'Spanish Squat'] }],
  sessions: [
    { id: 'old1', plan: 'A', name: 'Kraft & Ausdauer', type: 'Kraft', date: '2026-10-27', duration: 55, rpe: 6, pain: 3, note: 'Altes Training', status: 'done', items: [{ name: 'Bankdrücken', sets: [{ reps: '6', kg: '80', done: true }] }] },
  ],
  checkins: [{ date: '2026-10-28', pain: 2, energy: 4 }],
  custom: [],
  football: 'Donnerstag',
  partner: 'Alex',
};
