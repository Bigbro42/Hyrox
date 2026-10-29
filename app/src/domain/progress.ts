/**
 * Progress statistics. Only completed sessions and only entered values count. The race estimate
 * is an explicit, explained calculation from the athlete's own data – not a prediction.
 */
import { addDays, weekStart } from './calendar';
import { parseDate } from './dates';
import { exerciseHistory, personalBests, type ExerciseEntry } from './history';
import { RACE_RUN_METERS, RACE_RUNS, RACE_STATIONS, ROXZONE_SECONDS } from './hyrox';
import { STATION_ORDER, stationExercise } from './catalog';
import type { IsoDate, SessionKind, Settings, StationId, WorkoutSession } from './types';

export const completed = (sessions: readonly WorkoutSession[]) => sessions.filter((s) => s.status === 'completed');

export interface WeekBucket {
  start: IsoDate;
  sessions: number;
  minutes: number;
  byKind: Partial<Record<SessionKind, number>>;
}

/** The last `weeks` calendar weeks (Monday–Sunday), oldest first, including the current one. */
export function weekly(sessions: readonly WorkoutSession[], today: IsoDate, weeks = 12): WeekBucket[] {
  const first = addDays(weekStart(today), -7 * (weeks - 1));
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => ({ start: addDays(first, 7 * i), sessions: 0, minutes: 0, byKind: {} }));
  for (const s of completed(sessions)) {
    if (s.date < first || s.date > today) continue;
    const b = buckets[Math.floor((parseDate(s.date).getTime() - parseDate(first).getTime()) / (7 * 86_400_000))];
    if (!b) continue;
    b.sessions++;
    b.minutes += s.durationMin ?? 0;
    b.byKind[s.kind] = (b.byKind[s.kind] ?? 0) + 1;
  }
  return buckets;
}

export interface StationBest {
  station: StationId;
  exerciseId: string;
  name: string;
  /** Best logged set: amount in the station's metric and time. */
  best: { value: number; timeSec: number; date: IsoDate } | null;
  sessions: number;
}

export function stationBests(sessions: readonly WorkoutSession[]): StationBest[] {
  return STATION_ORDER.map((station) => {
    const def = stationExercise(station);
    const history = exerciseHistory(sessions, def.id);
    const pb = personalBests(history, def.metric).fastest;
    return { station, exerciseId: def.id, name: def.name, best: pb, sessions: history.length };
  });
}

/** Stations trained at least once (with any logged value). */
export function stationsTrained(sessions: readonly WorkoutSession[]): StationId[] {
  return stationBests(sessions).filter((s) => s.sessions > 0).map((s) => s.station);
}

export interface RunPoint {
  date: IsoDate;
  meters: number;
  timeSec: number;
  /** Seconds per kilometre. */
  pace: number;
}

const RUN_IDS = ['run-1k', 'run-easy'];

/** Every logged run with distance and time (at least 400 m), oldest first. */
export function runPoints(sessions: readonly WorkoutSession[]): RunPoint[] {
  const out: RunPoint[] = [];
  for (const id of RUN_IDS) {
    for (const e of exerciseHistory(sessions, id)) {
      for (const s of e.sets) {
        if (s.value !== null && s.value >= 400 && s.timeSec) out.push({ date: e.session.date, meters: s.value, timeSec: s.timeSec, pace: (s.timeSec / s.value) * 1000 });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function longestRun(sessions: readonly WorkoutSession[]): number {
  return Math.max(0, ...runPoints(sessions).map((r) => r.meters));
}

export interface EstimatePart {
  label: string;
  seconds: number;
  basis: string;
}

export type RaceEstimate =
  | { ready: false; missing: string[] }
  | { ready: true; low: number; high: number; parts: EstimatePart[] };

/** Linear extrapolation is optimistic; the upper bound adds 20 % for fatigue over the whole race. */
export const FATIGUE = 1.2;

/**
 * Rough race time from own data: 8 × 1 km at the average pace of the three fastest logged runs,
 * every station at the best logged rate scaled to the race volume and the planned own share,
 * plus an assumed 8 minutes in the Roxzone. The partner's share is assumed to take the same time.
 */
export function raceEstimate(sessions: readonly WorkoutSession[], settings: Pick<Settings, 'stationShare'>): RaceEstimate {
  const missing: string[] = [];
  const runs = runPoints(sessions).sort((a, b) => a.pace - b.pace).slice(0, 3);
  if (!runs.length) missing.push('Lauf mit Distanz und Zeit (mind. 400 m)');
  const bests = stationBests(sessions);
  for (const b of bests) if (!b.best) missing.push(b.name);
  if (missing.length) return { ready: false, missing };
  const runPace = runs.reduce((n, r) => n + r.pace, 0) / runs.length;
  const parts: EstimatePart[] = [{
    label: `${RACE_RUNS} × 1 km Laufen`,
    seconds: RACE_RUNS * (runPace * RACE_RUN_METERS) / 1000,
    basis: `Ø Tempo deiner ${runs.length === 1 ? 'besten Lauf' : `${runs.length} schnellsten Läufe`}`,
  }];
  for (const b of bests) {
    const best = b.best!;
    const facts = RACE_STATIONS[b.station];
    const share = settings.stationShare[b.station] / 100;
    // The partner covers the rest; assumed at the same rate, the station takes the full time.
    parts.push({
      label: b.name,
      seconds: (best.timeSec / best.value) * facts.amount,
      basis: `Bestwert ${best.value} ${facts.unit} in ${best.timeSec} s, hochgerechnet auf ${facts.amount} ${facts.unit} (dein Anteil ${Math.round(share * 100)} %)`,
    });
  }
  parts.push({ label: 'Roxzone & Wechsel', seconds: ROXZONE_SECONDS, basis: 'Annahme: 8 Minuten' });
  const low = parts.reduce((n, p) => n + p.seconds, 0);
  return { ready: true, low, high: low * FATIGUE, parts };
}

export interface ExerciseProgressPoint {
  date: IsoDate;
  value: number;
}

/** Per session the best estimated 1RM (weighted) or the best value, oldest first. */
export function exerciseProgress(entries: readonly ExerciseEntry[], metric: string): ExerciseProgressPoint[] {
  return [...entries].reverse().map((e) => {
    const pb = personalBests([e], e.exercise.metric);
    const value = metric === 'reps' && pb.bestE1rm ? pb.bestE1rm.kg : pb.bestValue?.value ?? 0;
    return { date: e.session.date, value: Math.round(value * 10) / 10 };
  });
}
