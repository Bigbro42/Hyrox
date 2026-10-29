import { parseDate, toIsoDate } from './dates';
import type { IsoDate, PlannedWorkout } from './types';

type Schedule = Pick<PlannedWorkout, 'startsOn' | 'recurrence'>;

function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

/**
 * Whether the rule itself produces an occurrence on `date` (exceptions not applied).
 * Monthly rules repeat on the start's day of month; months without that day are skipped
 * (a series started on the 31st has no occurrence in April).
 */
export function ruleMatches(plan: Schedule, date: IsoDate): boolean {
  const r = plan.recurrence;
  if (date < plan.startsOn) return false;
  if (r.freq === 'once') return date === plan.startsOn;
  if (r.until && date > r.until) return false;
  const interval = Math.max(1, Math.floor(r.interval) || 1);
  if (r.freq === 'daily') return daysBetween(plan.startsOn, date) % interval === 0;
  if (r.freq === 'weekly') return daysBetween(plan.startsOn, date) % (7 * interval) === 0;
  const a = parseDate(plan.startsOn);
  const b = parseDate(date);
  const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  return months >= 0 && months % interval === 0 && a.getDate() === b.getDate();
}

export interface Occurrence {
  /** Date the rule produced; identifies the occurrence even after a move. */
  original: IsoDate;
  /** Date the occurrence actually takes place on. */
  date: IsoDate;
}

/** Occurrences whose actual date lies in [from, to], with skips and moves applied. */
export function occurrencesBetween(plan: PlannedWorkout, from: IsoDate, to: IsoDate): Occurrence[] {
  const result: Occurrence[] = [];
  const cursor = parseDate(from < plan.startsOn ? plan.startsOn : from);
  const end = parseDate(to);
  while (cursor <= end) {
    const date = toIsoDate(cursor);
    if (ruleMatches(plan, date) && !plan.exceptions[date]) result.push({ original: date, date });
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const [original, ex] of Object.entries(plan.exceptions)) {
    if (ex.type === 'move' && ex.to >= from && ex.to <= to && ruleMatches(plan, original)) {
      result.push({ original, date: ex.to });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.original.localeCompare(b.original));
}

export function occursOn(plan: PlannedWorkout, date: IsoDate): boolean {
  return occurrencesBetween(plan, date, date).length > 0;
}
