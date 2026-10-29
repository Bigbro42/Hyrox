/** User actions of the workout flow. Each one changes the session purely and autosaves it. */
import type { AgendaEntry } from '../domain/calendar';
import { makeLookup } from '../domain/catalog';
import { today } from '../domain/dates';
import { newId } from '../domain/ids';
import * as S from '../domain/session';
import { KIND_LABELS } from '../domain/templates';
import type { ExerciseDef, KneeContext, SetEntry, WorkoutSession, WorkoutTemplate } from '../domain/types';
import { navigate } from '../ui/router';
import { activeSession, deleteSession, getState, saveKneeLog, saveSession, saveSettings, startRest, useAppState } from './store';

export function useLookup() {
  const { data } = useAppState();
  return makeLookup(data.customExercises);
}

function current(): WorkoutSession | null {
  return activeSession();
}

function apply(fn: (s: WorkoutSession) => WorkoutSession): WorkoutSession | null {
  const s = current();
  if (!s) return null;
  const next = fn(s);
  if (next !== s) void saveSession(next);
  return next;
}

function fromTemplate(t: WorkoutTemplate, opts: { plannedRef?: WorkoutSession['plannedRef'] } = {}): WorkoutSession {
  const lookup = makeLookup(getState().data.customExercises);
  const s = S.createSession({ date: today(), kind: t.kind, title: t.name, templateId: t.id, source: opts.plannedRef ? 'calendar' : 'manual' });
  return {
    ...s,
    ...(opts.plannedRef ? { plannedRef: opts.plannedRef } : {}),
    exercises: t.exercises.flatMap((x) => {
      const def = lookup(x.exerciseId);
      return def ? [S.newExercise(def, x.sets)] : [];
    }),
  };
}

/** Starts a template today, or returns to the workout already running. */
export function startTemplate(t: WorkoutTemplate, plannedRef?: WorkoutSession['plannedRef']): void {
  if (!activeSession()) void saveSession(fromTemplate(t, { plannedRef }));
  navigate({ name: 'workout' });
}

/** Starts an empty workout today (own selection of exercises). */
export function startFree(title = 'Freies Training'): void {
  if (!activeSession()) void saveSession(S.createSession({ date: today(), kind: 'free', title }));
  navigate({ name: 'workout' });
}

/**
 * Starts the workout of a calendar occurrence. An unfinished workout of the same occurrence is
 * continued instead of starting a second one.
 */
export function startFromOccurrence(entry: AgendaEntry): void {
  if (activeSession()) return navigate({ name: 'workout' });
  if (entry.session && entry.session.status === 'draft') return void reopenSession(entry.session);
  const plannedRef = { planId: entry.plan.id, occurrence: entry.original };
  const t = getState().data.templates.find((x) => x.id === entry.plan.templateId);
  if (t) return startTemplate(t, plannedRef);
  const s = { ...S.createSession({ date: today(), kind: entry.plan.kind, title: entry.plan.title || KIND_LABELS[entry.plan.kind], source: 'calendar' }), plannedRef };
  void saveSession(s);
  navigate({ name: 'workout' });
}

export function addToWorkout(def: ExerciseDef): string | null {
  const s = current();
  if (!s) return null;
  const ex = S.newExercise(def);
  apply((x) => S.addExercise(x, ex));
  return ex.id;
}

export const replaceInWorkout = (exId: string, def: ExerciseDef) => apply((s) => S.replaceExercise(s, exId, def));
export const removeFromWorkout = (exId: string) => apply((s) => S.removeExercise(s, exId));
export const moveInWorkout = (exId: string, delta: -1 | 1) => apply((s) => S.moveExercise(s, exId, delta));
export const updateWorkoutSet = (exId: string, setId: string, patch: Partial<Omit<SetEntry, 'id'>>) => apply((s) => S.updateSet(s, exId, setId, patch));
export const addWorkoutSet = (exId: string) => apply((s) => S.addSet(s, exId));
export const removeWorkoutSet = (exId: string, setId: string) => apply((s) => S.removeSet(s, exId, setId));
export const applyPreviousSets = (exId: string, previous: readonly SetEntry[]) => apply((s) => S.applyPrevious(s, exId, previous));
export const setWorkoutTitle = (title: string) => apply((s) => S.updateDetails(s, { title: title.trim() || 'Training' }));
export const setKneeBefore = (pain: number | null) => apply((s) => S.updateDetails(s, { kneeBefore: pain }));

/**
 * Ticks a set off. Ticking an empty set takes over the suggested values (previous performance);
 * without any value there is nothing to tick, so the caller focuses the input instead.
 */
export function toggleSetDone(exId: string, set: SetEntry, suggestion: SetEntry | undefined, restSeconds: number, restAuto: boolean): boolean {
  if (set.done) {
    updateWorkoutSet(exId, set.id, { done: false });
    return true;
  }
  const empty = set.value === null && set.timeSec === null;
  const value = set.value ?? (empty ? suggestion?.value ?? null : null);
  const timeSec = set.timeSec ?? (empty ? suggestion?.timeSec ?? null : null);
  if (value === null && timeSec === null) return false;
  updateWorkoutSet(exId, set.id, { done: true, value, timeSec, weightKg: set.weightKg ?? (empty ? suggestion?.weightKg ?? null : null) });
  if (restAuto) startRest(restSeconds);
  return true;
}

export function finishWorkout(details: S.CompleteDetails): WorkoutSession | null {
  const done = apply((s) => S.complete(s, details));
  if (done) {
    startRest(0);
    navigate({ name: 'summary', id: done.id }, true);
  }
  return done;
}

/** Leaves without completing: empty workouts are deleted, others are kept as "not completed". */
export function leaveWorkout(): void {
  const s = current();
  if (!s) return;
  startRest(0);
  if (!s.reopened && !S.hasLoggedWork(s) && s.kneeBefore === null && !s.legacy) void deleteSession(s.id);
  else void saveSession(S.park(s));
  navigate({ name: 'home' }, true);
}

export function reopenSession(session: WorkoutSession): boolean {
  if (current()) return false;
  void saveSession(session.status === 'draft' ? S.resume(session) : S.reopen(session));
  navigate({ name: 'workout' });
  return true;
}

export function rememberRest(seconds: number) {
  void saveSettings({ restSeconds: seconds });
}

/** A knee check outside of a workout. */
export function logKnee(pain: number, context: KneeContext, note: string): void {
  const now = new Date();
  void saveKneeLog({ id: newId('knee'), date: today(now), at: now.toISOString(), pain, context, note: note.trim(), rev: 1, updatedAt: now.toISOString() });
}

/** Football is logged after the fact (no live workout). */
export function logFootball(details: { date: string; durationMin: number | null; rpe: number | null; kneeAfter: number | null; note: string; plannedRef?: WorkoutSession['plannedRef'] }): WorkoutSession {
  const s = S.footballSession(details);
  void saveSession(s);
  return s;
}
