/**
 * XP, levels and milestones (Octalysis: development & accomplishment, ownership, meaning).
 * Ethical limits: no streaks, nothing is ever lost, rest days and illness cost nothing, XP never
 * depends on intensity or on training through pain, and knee check-ins are rewarded like work.
 */
import { stationsTrained, completed, longestRun } from './progress';
import { recordsIn } from './history';
import type { KneeLog, Settings, WorkoutSession } from './types';
import type { PlanPosition } from './phases';
import { kneePoints } from './knee';

export const XP_PER_KIND: Record<WorkoutSession['kind'], number> = { physio: 40, strength: 60, hyrox: 60, free: 40, football: 20 };
export const XP_PER_KNEE_DAY = 5;

export interface XpSummary {
  total: number;
  fromSessions: number;
  fromKneeChecks: number;
}

/** Knee values count once per day (check-in or before/after values of a workout). */
export function xp(sessions: readonly WorkoutSession[], knee: readonly KneeLog[]): XpSummary {
  const fromSessions = completed(sessions).reduce((n, s) => n + XP_PER_KIND[s.kind], 0);
  const days = new Set(kneePoints(sessions, knee).map((p) => p.date));
  const fromKneeChecks = days.size * XP_PER_KNEE_DAY;
  return { total: fromSessions + fromKneeChecks, fromSessions, fromKneeChecks };
}

export const LEVELS = [
  { xp: 0, name: 'Start' },
  { xp: 200, name: 'Grundlage' },
  { xp: 500, name: 'Technik' },
  { xp: 900, name: 'Ausdauer' },
  { xp: 1400, name: 'Stationen' },
  { xp: 2000, name: 'Doubles-ready' },
  { xp: 2700, name: 'Race-ready' },
  { xp: 3500, name: 'Finisher-Form' },
];

export interface LevelInfo {
  level: number;
  name: string;
  /** XP inside the current level and needed for the next one (null at the top). */
  into: number;
  span: number | null;
}

export function levelOf(total: number): LevelInfo {
  let i = 0;
  while (i + 1 < LEVELS.length && total >= LEVELS[i + 1]!.xp) i++;
  const cur = LEVELS[i]!;
  const next = LEVELS[i + 1];
  return { level: i + 1, name: cur.name, into: total - cur.xp, span: next ? next.xp - cur.xp : null };
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  current: number;
  goal: number;
}

export function milestones(sessions: readonly WorkoutSession[], knee: readonly KneeLog[], settings: Pick<Settings, 'runStep'>, position: PlanPosition): Milestone[] {
  const done = completed(sessions);
  const training = done.filter((s) => s.kind !== 'football');
  const physio = done.filter((s) => s.kind === 'physio').length;
  const kneeDays = new Set(kneePoints(sessions, knee).map((p) => p.date)).size;
  const stations = stationsTrained(sessions).length;
  const simulation = done.some((s) => s.kind === 'hyrox' && new Set(s.exercises.filter((x) => x.exerciseId.startsWith('hyrox-') && x.sets.some((set) => set.value !== null)).map((x) => x.exerciseId)).size >= 6) ? 1 : 0;
  const records = done.some((s) => recordsIn(s, done).length > 0) ? 1 : 0;
  const week = position.kind === 'week' ? position.week : position.kind === 'raceweek' || position.kind === 'after' ? 16 : 0;
  return [
    { id: 'first', title: 'Erster Schritt', description: 'Die erste Einheit abschließen', current: Math.min(1, training.length), goal: 1 },
    { id: 'physio4', title: 'Knie-Routine', description: 'Vier Physio-Einheiten', current: Math.min(4, physio), goal: 4 },
    { id: 'knee10', title: 'Auf dein Knie hören', description: 'An zehn Tagen Kniewerte eintragen', current: Math.min(10, kneeDays), goal: 10 },
    { id: 'stations', title: 'Alle Stationen', description: 'Jede der acht HYROX-Stationen einmal trainieren', current: stations, goal: 8 },
    { id: 'sessions12', title: 'Dranbleiber', description: 'Zwölf abgeschlossene Einheiten', current: Math.min(12, training.length), goal: 12 },
    { id: 'record', title: 'Persönlicher Rekord', description: 'Eine eigene Bestleistung verbessern', current: records, goal: 1 },
    { id: 'runladder', title: 'Laufleiter Stufe 5', description: 'Schrittweise und beschwerdearm zurück zum Laufen', current: Math.min(5, settings.runStep), goal: 5 },
    { id: 'run5k', title: '5 km am Stück', description: 'Einen Lauf über 5 km eintragen – wenn das Knie es zulässt', current: Math.min(5, Math.floor(longestRun(sessions) / 1000)), goal: 5 },
    { id: 'simulation', title: 'Doubles-Simulation', description: 'Eine HYROX-Einheit mit mindestens sechs Stationen', current: simulation, goal: 1 },
    { id: 'halfway', title: 'Halbzeit', description: 'Woche 8 des Plans erreicht', current: Math.min(8, week), goal: 8 },
    { id: 'sessions36', title: 'Bereit für Wien', description: '36 abgeschlossene Einheiten', current: Math.min(36, training.length), goal: 36 },
  ];
}
