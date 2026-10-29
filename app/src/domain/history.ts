/**
 * Per-exercise history and personal bests. Only completed sessions count; drafts and the running
 * session are never used as "performance".
 */
import { clock, fmtNum } from './format';
import type { Metric, SessionExercise, SetEntry, WorkoutSession } from './types';

export interface ExerciseEntry {
  session: WorkoutSession;
  exercise: SessionExercise;
  /** Sets with an entered value or time. */
  sets: SetEntry[];
}

export const logged = (s: SetEntry) => s.value !== null || s.timeSec !== null;

/** Newest first. Every appearance of the exercise in a completed session with logged values. */
export function exerciseHistory(sessions: readonly WorkoutSession[], exerciseId: string, excludeSessionId?: string): ExerciseEntry[] {
  const out: ExerciseEntry[] = [];
  for (const session of sessions) {
    if (session.status !== 'completed' || session.id === excludeSessionId) continue;
    for (const exercise of session.exercises) {
      if (exercise.exerciseId !== exerciseId) continue;
      const sets = exercise.sets.filter(logged);
      if (sets.length) out.push({ session, exercise, sets });
    }
  }
  return out.sort((a, b) => b.session.date.localeCompare(a.session.date) || (b.session.completedAt ?? '').localeCompare(a.session.completedAt ?? ''));
}

/** Estimated one-repetition maximum (Epley); only for 1–12 repetitions with load. */
export function e1rm(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps < 1 || reps > 12) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

export interface PersonalBests {
  heaviest: { weightKg: number; value: number; date: string } | null;
  /** Most repetitions, longest hold or longest distance in one set. */
  bestValue: { value: number; weightKg: number | null; date: string } | null;
  /** Best estimated 1RM (weighted repetitions only). */
  bestE1rm: { kg: number; date: string } | null;
  /** Fastest rate for timed sets: seconds per meter (or per repetition). */
  fastest: { value: number; timeSec: number; date: string } | null;
}

export function personalBests(entries: readonly ExerciseEntry[], metric: Metric): PersonalBests {
  const pb: PersonalBests = { heaviest: null, bestValue: null, bestE1rm: null, fastest: null };
  for (const e of entries) {
    for (const s of e.sets) {
      if (s.value === null) continue;
      const v = s.value;
      if (s.weightKg !== null && s.weightKg > 0) {
        if (!pb.heaviest || s.weightKg > pb.heaviest.weightKg || (s.weightKg === pb.heaviest.weightKg && v > pb.heaviest.value)) {
          pb.heaviest = { weightKg: s.weightKg, value: v, date: e.session.date };
        }
        const est = metric === 'reps' ? e1rm(s.weightKg, v) : null;
        if (est && (!pb.bestE1rm || est > pb.bestE1rm.kg)) pb.bestE1rm = { kg: est, date: e.session.date };
      }
      if (!pb.bestValue || v > pb.bestValue.value) pb.bestValue = { value: v, weightKg: s.weightKg, date: e.session.date };
      if (s.timeSec !== null && s.timeSec > 0 && v > 0 && (metric === 'meters' || metric === 'reps')) {
        if (!pb.fastest || s.timeSec / v < pb.fastest.timeSec / pb.fastest.value) pb.fastest = { value: v, timeSec: s.timeSec, date: e.session.date };
      }
    }
  }
  return pb;
}

const METRIC_SHORT: Record<Metric, string> = { reps: 'Wdh.', seconds: 'Sek.', minutes: 'Min.', meters: 'm' };

export function setLabel(s: SetEntry, metric: Metric): string {
  const parts: string[] = [];
  if (s.weightKg) parts.push(`${fmtNum(s.weightKg)} kg`);
  if (s.value !== null) parts.push(`${fmtNum(s.value)} ${METRIC_SHORT[metric]}`);
  const main = parts.join(' × ');
  return s.timeSec !== null ? `${main}${main ? ' in ' : ''}${clock(s.timeSec)}` : main;
}

/** Compact "80 kg × 8 · 80 kg × 7" or "250 m in 1:02". */
export function setsSummary(sets: readonly SetEntry[], metric: Metric): string {
  return sets.filter(logged).map((s) => setLabel(s, metric)).join(' · ');
}

export interface NewRecord {
  exerciseId: string;
  name: string;
  label: string;
}

/** Records in the given session compared with everything completed before it. A first time is not a record. */
export function recordsIn(session: WorkoutSession, all: readonly WorkoutSession[]): NewRecord[] {
  const out: NewRecord[] = [];
  const seen = new Set<string>();
  const earlier = all.filter((s) => s.id !== session.id && (s.date < session.date || (s.date === session.date && (s.completedAt ?? '') < (session.completedAt ?? ''))));
  for (const x of session.exercises) {
    if (seen.has(x.exerciseId)) continue;
    seen.add(x.exerciseId);
    const before = exerciseHistory(earlier, x.exerciseId);
    if (!before.length) continue;
    const sets = session.exercises.filter((e) => e.exerciseId === x.exerciseId).flatMap((e) => e.sets.filter(logged));
    const old = personalBests(before, x.metric);
    const now = personalBests([{ session, exercise: x, sets }], x.metric);
    if (now.heaviest && (!old.heaviest || now.heaviest.weightKg > old.heaviest.weightKg)) {
      out.push({ exerciseId: x.exerciseId, name: x.name, label: `${fmtNum(now.heaviest.weightKg)} kg × ${fmtNum(now.heaviest.value)}` });
    } else if (now.fastest && old.fastest && now.fastest.timeSec / now.fastest.value < old.fastest.timeSec / old.fastest.value && now.fastest.value >= old.fastest.value * 0.8) {
      out.push({ exerciseId: x.exerciseId, name: x.name, label: `${fmtNum(now.fastest.value)} ${METRIC_SHORT[x.metric]} in ${clock(now.fastest.timeSec)}` });
    } else if (!x.timed && now.bestValue && old.bestValue && now.bestValue.value > old.bestValue.value && (now.bestValue.weightKg ?? 0) >= (old.bestValue.weightKg ?? 0)) {
      out.push({ exerciseId: x.exerciseId, name: x.name, label: `${fmtNum(now.bestValue.value)} ${METRIC_SHORT[x.metric]}` });
    }
  }
  return out;
}

/**
 * Working-weight suggestion from the best estimated 1RM: a load that leaves about two to three
 * repetitions in reserve at the target repetitions, rounded to 2.5 kg.
 */
export function suggestedWeight(bestE1rm: number, targetReps: number): number {
  const kg = bestE1rm / (1 + (targetReps + 2.5) / 30);
  return Math.max(2.5, Math.round(kg / 2.5) * 2.5);
}
