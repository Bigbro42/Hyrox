/**
 * Calendar operations, the agenda and the standard week. Planned entries never count as
 * training: an occurrence is "done" only when a completed session points to it.
 */
import { parseDate, toIsoDate } from './dates';
import { newId } from './ids';
import { occurrencesBetween } from './recurrence';
import { INTENSIVE_KINDS, KIND_LABELS, TEMPLATE_IDS } from './templates';
import type { IsoDate, PlannedWorkout, SessionKind, Settings, Slot, WorkoutSession, WorkoutTemplate } from './types';

export const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export function addDays(iso: IsoDate, n: number): IsoDate {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

/** Monday of the week containing `iso`. */
export function weekStart(iso: IsoDate): IsoDate {
  return addDays(iso, -((parseDate(iso).getDay() + 6) % 7));
}

/** First date on or after `from` that falls on `weekday` (0 = Sunday). */
export function nextWeekday(from: IsoDate, weekday: number): IsoDate {
  return addDays(from, (weekday - parseDate(from).getDay() + 7) % 7);
}

function touch(p: PlannedWorkout, patch: Partial<PlannedWorkout>, now: Date): PlannedWorkout {
  return { ...p, ...patch, rev: p.rev + 1, updatedAt: now.toISOString() };
}

export interface PlanInput {
  title: string;
  kind: SessionKind;
  templateId: string | null;
  startsOn: IsoDate;
  time: string | null;
  slot?: Slot;
  weeklyUntil?: IsoDate;
}

export function createPlan(input: PlanInput, now = new Date()): PlannedWorkout {
  const { weeklyUntil, ...rest } = input;
  return {
    id: newId('plan'),
    ...rest,
    title: input.title.trim() || 'Training',
    recurrence: weeklyUntil ? { freq: 'weekly', interval: 1, until: weeklyUntil } : { freq: 'once' },
    exceptions: {},
    rev: 1,
    updatedAt: now.toISOString(),
  };
}

export function skipOccurrence(p: PlannedWorkout, original: IsoDate, now = new Date()): PlannedWorkout {
  return touch(p, { exceptions: { ...p.exceptions, [original]: { type: 'skip' } } }, now);
}

export function restoreOccurrence(p: PlannedWorkout, original: IsoDate, now = new Date()): PlannedWorkout {
  const { [original]: _, ...rest } = p.exceptions;
  return touch(p, { exceptions: rest }, now);
}

export function moveOccurrence(p: PlannedWorkout, original: IsoDate, to: IsoDate, now = new Date()): PlannedWorkout {
  if (p.recurrence.freq === 'once') return touch(p, { startsOn: to }, now);
  if (to === original) return restoreOccurrence(p, original, now);
  return touch(p, { exceptions: { ...p.exceptions, [original]: { type: 'move', to } } }, now);
}

/** Ends a series the day before `date`. Returns null when nothing would remain. */
export function endSeriesBefore(p: PlannedWorkout, date: IsoDate, now = new Date()): PlannedWorkout | null {
  if (p.recurrence.freq === 'once' || date <= p.startsOn) return null;
  const until = addDays(date, -1);
  const exceptions = Object.fromEntries(Object.entries(p.exceptions).filter(([k]) => k <= until));
  return touch(p, { recurrence: { ...p.recurrence, until }, exceptions }, now);
}

/** The series of a standard unit that is still running (or starts) on/after `today`. */
export function activeSeries(plans: readonly PlannedWorkout[], slot: Slot, today: IsoDate): PlannedWorkout | null {
  return plans.find((p) => p.slot === slot && p.recurrence.freq !== 'once' && (p.recurrence.until === null || p.recurrence.until >= today)) ?? null;
}

export const SLOT_TEMPLATE: Record<Exclude<Slot, 'F'>, string> = { A: TEMPLATE_IDS.A, B: TEMPLATE_IDS.B, C: TEMPLATE_IDS.C };

export function slotWeekday(settings: Pick<Settings, 'days' | 'football'>, slot: Slot): number | null {
  if (slot === 'F') return settings.football === 'thursday' ? 4 : settings.football === 'sunday' ? 0 : null;
  return settings.days[slot];
}

export interface PlanChanges {
  save: PlannedWorkout[];
  remove: string[];
}

/**
 * Brings the standard week in line with the settings: every unit whose weekday changed ends
 * before today and continues on the new weekday from today on. Past occurrences (and the
 * workouts linked to them) stay untouched.
 */
export function syncStandardWeek(plans: readonly PlannedWorkout[], templates: readonly WorkoutTemplate[], settings: Settings, today: IsoDate, now = new Date()): PlanChanges {
  const out: PlanChanges = { save: [], remove: [] };
  if (today > settings.raceDate) return out;
  const from = today < settings.planStart ? settings.planStart : today;
  const until = addDays(settings.raceDate, -1);
  for (const slot of ['A', 'B', 'C', 'F'] as Slot[]) {
    const weekday = slotWeekday(settings, slot);
    const current = activeSeries(plans, slot, today);
    if (current && weekday !== null && parseDate(current.startsOn).getDay() === weekday && current.recurrence.freq !== 'once' && current.recurrence.until === until) continue;
    if (current) {
      const ended = endSeriesBefore(current, today, now);
      if (ended) out.save.push(ended);
      else out.remove.push(current.id);
    }
    if (weekday === null) continue;
    const templateId = slot === 'F' ? null : SLOT_TEMPLATE[slot];
    const template = templates.find((t) => t.id === templateId);
    const startsOn = nextWeekday(from, weekday);
    if (startsOn > until) continue;
    out.save.push(createPlan({
      title: slot === 'F' ? 'Fußball' : template?.name ?? KIND_LABELS[slot === 'A' ? 'physio' : slot === 'B' ? 'strength' : 'hyrox'],
      kind: slot === 'F' ? 'football' : slot === 'A' ? 'physio' : slot === 'B' ? 'strength' : 'hyrox',
      templateId,
      startsOn,
      time: null,
      slot,
      weeklyUntil: until,
    }, now));
  }
  const race = plans.find((p) => p.id === RACE_PLAN_ID);
  if (race && (race.startsOn !== settings.raceDate || race.title !== settings.raceName)) {
    out.save.push(touch(race, { startsOn: settings.raceDate, title: settings.raceName }, now));
  } else if (!race) {
    out.save.push({ ...createPlan({ title: settings.raceName, kind: 'free', templateId: null, startsOn: settings.raceDate, time: null }, now), id: RACE_PLAN_ID });
  }
  return out;
}

export const RACE_PLAN_ID = 'plan-race';

export type AgendaStatus = 'planned' | 'done' | 'started' | 'open' | 'skipped';

export interface AgendaEntry {
  kind: 'occurrence';
  plan: PlannedWorkout;
  original: IsoDate;
  date: IsoDate;
  status: AgendaStatus;
  session: WorkoutSession | null;
}

export interface SessionEntry {
  kind: 'session';
  date: IsoDate;
  session: WorkoutSession;
}

export type DayEntry = AgendaEntry | SessionEntry;

function linkedSessions(sessions: readonly WorkoutSession[]) {
  const map = new Map<string, WorkoutSession>();
  for (const s of sessions) {
    if (!s.plannedRef) continue;
    const key = `${s.plannedRef.planId}|${s.plannedRef.occurrence}`;
    const prev = map.get(key);
    if (!prev || (s.status === 'completed' && prev.status !== 'completed')) map.set(key, s);
  }
  return map;
}

/**
 * Everything between `from` and `to`, by day: planned occurrences with their status and sessions
 * that do not belong to an occurrence in that range. A past occurrence without a workout is
 * "open" – neutral wording on purpose: rest is allowed.
 */
export function agenda(plans: readonly PlannedWorkout[], sessions: readonly WorkoutSession[], from: IsoDate, to: IsoDate, today: IsoDate, includeSkipped = false): Map<IsoDate, DayEntry[]> {
  const days = new Map<IsoDate, DayEntry[]>();
  const push = (d: IsoDate, e: DayEntry) => days.set(d, [...(days.get(d) ?? []), e]);
  const linked = linkedSessions(sessions);
  const shown = new Set<string>();
  for (const plan of plans) {
    for (const o of occurrencesBetween(plan, from, to)) {
      const session = linked.get(`${plan.id}|${o.original}`) ?? null;
      if (session) shown.add(session.id);
      const status: AgendaStatus = session?.status === 'completed' ? 'done' : session ? 'started' : o.date < today ? 'open' : 'planned';
      push(o.date, { kind: 'occurrence', plan, original: o.original, date: o.date, status, session });
    }
    if (includeSkipped) {
      for (const [original, ex] of Object.entries(plan.exceptions)) {
        if (ex.type === 'skip' && original >= from && original <= to) {
          push(original, { kind: 'occurrence', plan, original, date: original, status: 'skipped', session: null });
        }
      }
    }
  }
  for (const s of sessions) {
    if (s.date < from || s.date > to || shown.has(s.id) || s.status === 'active') continue;
    push(s.date, { kind: 'session', date: s.date, session: s });
  }
  return days;
}

/** Next planned occurrences from today on (not yet done). */
export function upcoming(plans: readonly PlannedWorkout[], sessions: readonly WorkoutSession[], today: IsoDate, limit = 3, horizonDays = 60): AgendaEntry[] {
  const days = agenda(plans, sessions, today, addDays(today, horizonDays), today);
  const out: AgendaEntry[] = [];
  for (const d of [...days.keys()].sort()) {
    for (const e of days.get(d)!) if (e.kind === 'occurrence' && (e.status === 'planned' || e.status === 'started')) out.push(e);
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

export function entryKind(e: DayEntry): SessionKind {
  return e.kind === 'occurrence' ? e.plan.kind : e.session.kind;
}

export interface LoadWarning {
  dates: [IsoDate, IsoDate];
  text: string;
}

/**
 * Intensive days (strength, HYROX, football) directly after each other within the range. Only
 * planned or done entries count; skipped ones do not.
 */
export function loadWarnings(days: Map<IsoDate, DayEntry[]>, from: IsoDate, to: IsoDate): LoadWarning[] {
  const intensive = (d: IsoDate) => (days.get(d) ?? []).filter((e) => (e.kind === 'session' ? e.session.status === 'completed' : e.status !== 'skipped') && INTENSIVE_KINDS.includes(entryKind(e)));
  const out: LoadWarning[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) {
    const next = addDays(d, 1);
    const a = intensive(d);
    const b = intensive(next);
    if (!a.length || !b.length) continue;
    const football = [...a, ...b].some((e) => entryKind(e) === 'football');
    out.push({
      dates: [d, next],
      text: football
        ? `${WEEKDAYS[parseDate(d).getDay()]} und ${WEEKDAYS[parseDate(next).getDay()]}: Fußball direkt neben einer intensiven Einheit. Für das Knie besser einen Tag Abstand lassen.`
        : `${WEEKDAYS[parseDate(d).getDay()]} und ${WEEKDAYS[parseDate(next).getDay()]}: zwei intensive Einheiten hintereinander.`,
    });
  }
  return out;
}

/** 6 × 7 grid of dates (Monday first) covering the month of `month` ("YYYY-MM"). */
export function monthGrid(month: string): IsoDate[] {
  const [y, m] = month.split('-').map(Number);
  const start = weekStart(toIsoDate(new Date(y!, m! - 1, 1, 12)));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y!, m! - 1 + delta, 1, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
