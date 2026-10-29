import { describe, expect, it } from 'vitest';
import { activeSeries, agenda, loadWarnings, moveOccurrence, nextWeekday, RACE_PLAN_ID, skipOccurrence, syncStandardWeek } from '../src/domain/calendar';
import { parseDate } from '../src/domain/dates';
import { occurrencesBetween } from '../src/domain/recurrence';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/domain/settings';
import { defaultTemplates } from '../src/domain/templates';
import type { PlannedWorkout } from '../src/domain/types';
import { doneSession, NOW } from './fixtures';

const templates = defaultTemplates(NOW.toISOString());
const settings = normalizeSettings({ ...DEFAULT_SETTINGS, planStart: '2026-10-26' });
const apply = (plans: PlannedWorkout[], changes: { save: PlannedWorkout[]; remove: string[] }) => {
  const ids = new Set([...changes.save.map((p) => p.id), ...changes.remove]);
  return [...plans.filter((p) => !ids.has(p.id)), ...changes.save];
};

describe('standard week', () => {
  const plans = apply([], syncStandardWeek([], templates, settings, '2026-11-04', NOW));

  it('creates A, B, C, football and the race day', () => {
    expect(plans.map((p) => p.slot ?? p.id).sort()).toEqual(['A', 'B', 'C', 'F', RACE_PLAN_ID].sort());
    const weekday = (slot: string) => parseDate(plans.find((p) => p.slot === slot)!.startsOn).getDay();
    expect([weekday('A'), weekday('B'), weekday('C'), weekday('F')]).toEqual([3, 1, 6, 4]);
    expect(plans.find((p) => p.slot === 'A')!.startsOn).toBe('2026-11-04');
    expect(plans.find((p) => p.id === RACE_PLAN_ID)!.startsOn).toBe('2027-02-19');
  });

  it('is stable when nothing changed', () => {
    expect(syncStandardWeek(plans, templates, settings, '2026-11-04', NOW)).toEqual({ save: [], remove: [] });
  });

  it('moves a unit to a new weekday from today on and keeps the past', () => {
    const later = '2026-11-20';
    const changed = apply(plans, syncStandardWeek(plans, templates, { ...settings, days: { ...settings.days, B: 2 } }, later, NOW));
    const old = changed.find((p) => p.slot === 'B' && p.recurrence.freq === 'weekly' && p.recurrence.until === '2026-11-19');
    expect(old).toBeTruthy();
    const current = activeSeries(changed, 'B', later)!;
    expect(parseDate(current.startsOn).getDay()).toBe(2);
    expect(current.startsOn >= later).toBe(true);
  });

  it('removes football from today on when paused', () => {
    const changed = apply(plans, syncStandardWeek(plans, templates, { ...settings, football: 'none' }, '2026-11-04', NOW));
    expect(activeSeries(changed, 'F', '2026-11-04')).toBeNull();
  });
});

describe('agenda', () => {
  const plans = apply([], syncStandardWeek([], templates, settings, '2026-11-02', NOW));
  const football = plans.find((p) => p.slot === 'F')!;

  it('moves and skips single occurrences', () => {
    const moved = moveOccurrence(football, '2026-11-05', '2026-11-08');
    expect(occurrencesBetween(moved, '2026-11-02', '2026-11-08')).toEqual([{ original: '2026-11-05', date: '2026-11-08' }]);
    expect(occurrencesBetween(skipOccurrence(football, '2026-11-05'), '2026-11-02', '2026-11-08')).toEqual([]);
  });

  it('links a completed workout to its occurrence and marks past ones neutrally as open', () => {
    const a = plans.find((p) => p.slot === 'A')!;
    const s = { ...doneSession({ date: '2026-11-04', exerciseId: 'physio-copenhagen', sets: [{ value: 20 }], kind: 'physio' }), plannedRef: { planId: a.id, occurrence: '2026-11-04' } };
    const days = agenda(plans, [s], '2026-11-02', '2026-11-08', '2026-11-07');
    const wed = days.get('2026-11-04')!;
    expect(wed).toHaveLength(1);
    expect(wed[0]!.kind === 'occurrence' && wed[0]!.status).toBe('done');
    const mon = days.get('2026-11-02')!;
    expect(mon[0]!.kind === 'occurrence' && mon[0]!.status).toBe('open');
  });

  it('warns about football right next to an intensive unit', () => {
    const moved = moveOccurrence(football, '2026-11-05', '2026-11-08');
    const all = plans.map((p) => (p.id === football.id ? moved : p));
    const days = agenda(all, [], '2026-11-02', '2026-11-08', '2026-11-02');
    const warnings = loadWarnings(days, '2026-11-02', '2026-11-08');
    expect(warnings.map((w) => w.dates)).toEqual([['2026-11-07', '2026-11-08']]);
    expect(warnings[0]!.text).toContain('Fußball');
  });

  it('finds the next weekday', () => {
    expect(nextWeekday('2026-11-04', 3)).toBe('2026-11-04');
    expect(nextWeekday('2026-11-04', 1)).toBe('2026-11-09');
  });
});
