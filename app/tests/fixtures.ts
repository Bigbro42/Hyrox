import { emptySet, newExercise, createSession, complete } from '../src/domain/session';
import { builtin } from '../src/domain/catalog';
import type { WorkoutSession } from '../src/domain/types';

export const NOW = new Date('2026-11-04T18:00:00+01:00');

/** A completed workout with one exercise and the given sets. */
export function doneSession(opts: { date: string; exerciseId: string; sets: { value?: number | null; weightKg?: number | null; timeSec?: number | null }[]; kind?: WorkoutSession['kind']; kneeBefore?: number | null; kneeAfter?: number | null }): WorkoutSession {
  const def = builtin(opts.exerciseId)!;
  const ex = newExercise(def, opts.sets.length);
  ex.sets = opts.sets.map((s) => ({ ...emptySet(), value: s.value ?? null, weightKg: s.weightKg ?? null, timeSec: s.timeSec ?? null, done: true }));
  const s = { ...createSession({ date: opts.date, kind: opts.kind ?? 'strength', title: 'Test', now: new Date(`${opts.date}T17:00:00+01:00`) }), exercises: [ex], kneeBefore: opts.kneeBefore ?? null };
  return complete(s, { rpe: 6, note: '', durationMin: 50, kneeAfter: opts.kneeAfter ?? null }, new Date(`${opts.date}T18:00:00+01:00`));
}

/** State of the previous single-file app as stored in localStorage. */
export const LEGACY_STATE = {
  v: 1,
  plans: [
    { id: 'P', name: 'Physio & Knie', kind: 'Physio', mins: 45, items: ['Radfahren locker', 'Spanish Squat', 'Copenhagen Plank', 'SL Hamstring Bridge isometrisch', 'Seated Leg Raise', 'Seated Hip Internal Rotation', 'Tibialis Rotation'] },
    { id: 'A', name: 'Kraft & Ausdauer', kind: 'Kraft', mins: 55, items: ['Radfahren locker', 'Rumänisches Kreuzheben', 'Bankdrücken', 'Kabelrudern', 'Glute Bridge'] },
    { id: 'C', name: 'Mein HYROX', kind: 'HYROX', mins: 60, items: ['SkiErg', 'Meine Übung', 'Farmers Carry'] },
  ],
  sessions: [
    { id: 'a1', plan: 'A', name: 'Kraft & Ausdauer', type: 'Kraft', date: '2026-10-27', duration: 55, rpe: 6, pain: 3, note: 'gut', status: 'done', items: [{ name: 'Bankdrücken', sets: [{ reps: '6', kg: '80', done: true }, { reps: '3 × 6', kg: '80', done: true }] }] },
    { id: 'a2', plan: 'P', name: 'Physio & Knie', type: 'Physio', date: '2026-10-28', duration: 45, rpe: 5, pain: 5, note: '', status: 'draft', items: [{ name: 'Spanish Squat', sets: [{ reps: '3 × 20 Sek.', kg: '', done: false }] }] },
    { id: 'a3', plan: 'C', name: 'HYROX', type: 'HYROX', date: '2026-10-28', duration: 50, rpe: 7, pain: 2, note: '', status: 'draft', items: [{ name: 'SkiErg', sets: [{ reps: '250', kg: '', done: true }] }] },
    { id: 'broken', date: 'kein Datum' },
  ],
  checkins: [{ date: '2026-10-28', pain: 4, energy: 3 }, { date: '2026-10-29', pain: 99 }],
  custom: ['Meine Übung'],
  football: 'Sonntag',
  partner: 'Alex',
  activeWeek: 1,
  notes: '',
  levelSettings: {},
  cleared: false,
};
