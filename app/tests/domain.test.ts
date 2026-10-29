import { describe, expect, it } from 'vitest';
import { LIBRARY_EXERCISES, tierOf } from '../src/domain/catalog';
import { levelOf, milestones, xp } from '../src/domain/gamification';
import { e1rm, personalBests, exerciseHistory, recordsIn, suggestedWeight } from '../src/domain/history';
import { planPosition } from '../src/domain/phases';
import { raceEstimate, runPoints, stationBests } from '../src/domain/progress';
import { runAdvice } from '../src/domain/running';
import { createSession, hasLoggedWork, LockedError, newExercise, park, updateSet } from '../src/domain/session';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/domain/settings';
import { DEFAULT_TEMPLATES } from '../src/domain/templates';
import { builtin } from '../src/domain/catalog';
import type { WorkoutSession } from '../src/domain/types';
import { doneSession, NOW } from './fixtures';

describe('exercise library', () => {
  const physio = LIBRARY_EXERCISES.filter((x) => x.category === 'physio');
  it('contains all 15 physio exercises with full content', () => {
    expect(physio).toHaveLength(15);
    for (const x of physio) {
      expect(x.description.length, x.name).toBeGreaterThan(40);
      expect(x.steps.length, x.name).toBeGreaterThanOrEqual(2);
      expect(x.mistakes.length, x.name).toBeGreaterThanOrEqual(1);
      expect(x.safety, x.name).not.toBe('');
      expect(x.easier && x.harder, x.name).toBeTruthy();
      expect(x.primaryMuscles.length, x.name).toBeGreaterThan(0);
      expect(x.dose, x.name).not.toBe('');
    }
  });
  it('does not plan jumps or sissy squats as regular start exercises', () => {
    for (const id of ['physio-lunge-jump', 'physio-sissy-squat', 'physio-sl-box-jump', 'hyrox-burpee-broad-jump']) expect(builtin(id)!.tier).toBe('locked');
    for (const t of DEFAULT_TEMPLATES) for (const x of t.exercises) expect(['basis', 'optional']).toContain(builtin(x.exerciseId)!.tier);
  });
  it('has all eight stations and unique ids', () => {
    expect(new Set(LIBRARY_EXERCISES.filter((x) => x.station).map((x) => x.station)).size).toBe(8);
    expect(new Set(LIBRARY_EXERCISES.map((x) => x.id)).size).toBe(LIBRARY_EXERCISES.length);
  });
  it('lets the athlete override the release status', () => {
    const def = builtin('physio-lunge-hold-toes')!;
    expect(tierOf(def, DEFAULT_SETTINGS)).toBe('progression');
    expect(tierOf(def, { status: { [def.id]: 'basis' } })).toBe('basis');
  });
});

describe('session', () => {
  it('counts timed sets as logged work and protects completed sessions', () => {
    let s = createSession({ date: '2026-11-04', kind: 'hyrox', title: 'C', now: NOW });
    const ex = newExercise(builtin('hyrox-skierg')!);
    s = { ...s, exercises: [ex] };
    expect(hasLoggedWork(s)).toBe(false);
    s = updateSet(s, ex.id, ex.sets[0]!.id, { timeSec: 65 });
    expect(hasLoggedWork(s)).toBe(true);
    expect(park(s).status).toBe('draft');
    const done = doneSession({ date: '2026-11-04', exerciseId: 'hyrox-skierg', sets: [{ value: 250 }] });
    expect(() => updateSet(done, done.exercises[0]!.id, done.exercises[0]!.sets[0]!.id, { value: 1 })).toThrow(LockedError);
  });
});

describe('history and progress', () => {
  const sessions: WorkoutSession[] = [
    doneSession({ date: '2026-11-02', exerciseId: 'strength-bench-press', sets: [{ value: 5, weightKg: 85 }] }),
    doneSession({ date: '2026-11-09', exerciseId: 'strength-bench-press', sets: [{ value: 5, weightKg: 87.5 }] }),
    doneSession({ date: '2026-11-03', exerciseId: 'run-1k', sets: [{ value: 1000, timeSec: 390 }], kind: 'hyrox' }),
  ];
  it('finds personal bests and records, estimates working weights', () => {
    const pb = personalBests(exerciseHistory(sessions, 'strength-bench-press'), 'reps');
    expect(pb.heaviest?.weightKg).toBe(87.5);
    expect(recordsIn(sessions[1]!, sessions)).toHaveLength(1);
    expect(recordsIn(sessions[0]!, sessions)).toHaveLength(0);
    expect(e1rm(90, 3)).toBeCloseTo(99);
    expect(suggestedWeight(99, 5)).toBe(80);
  });
  it('collects runs with pace and only estimates the race with complete data', () => {
    expect(runPoints(sessions)[0]!.pace).toBe(390);
    const est = raceEstimate(sessions, DEFAULT_SETTINGS);
    expect(est.ready).toBe(false);
    expect(!est.ready && est.missing).toContain('SkiErg');
    const full = [...sessions, ...stationBests([]).map((b) => doneSession({ date: '2026-11-05', exerciseId: b.exerciseId, sets: [{ value: b.station === 'wallballs' ? 20 : 100, timeSec: 30 }], kind: 'hyrox' }))];
    const ready = raceEstimate(full, DEFAULT_SETTINGS);
    expect(ready.ready).toBe(true);
    expect(ready.ready && ready.high).toBeGreaterThan(ready.ready ? ready.low : 0);
  });
});

describe('gamification and plan', () => {
  it('awards XP for sessions and knee days, without streak penalties', () => {
    const s = [doneSession({ date: '2026-11-02', exerciseId: 'physio-copenhagen', sets: [{ value: 20 }], kind: 'physio', kneeBefore: 1, kneeAfter: 1 })];
    expect(xp(s, []).total).toBe(45);
    expect(levelOf(0)).toMatchObject({ level: 1, into: 0, span: 200 });
    expect(levelOf(250).level).toBe(2);
    const ms = milestones(s, [], DEFAULT_SETTINGS, { kind: 'before', startsIn: 3 });
    expect(ms.find((m) => m.id === 'first')!.current).toBe(1);
  });
  it('knows the plan week and phase', () => {
    const st = normalizeSettings({ planStart: '2026-10-26', raceDate: '2027-02-19' });
    expect(planPosition(st, '2026-10-29')).toMatchObject({ kind: 'week', week: 1 });
    expect(planPosition(st, '2026-12-17')).toMatchObject({ kind: 'week', week: 8, deload: true });
    expect(planPosition(st, '2027-02-16')).toEqual({ kind: 'raceweek' });
    expect(planPosition(st, '2027-03-01')).toEqual({ kind: 'after' });
  });
  it('never suggests a step up on yellow, red or continuous running without assessment', () => {
    expect(runAdvice('red', 3, false).action).toBe('down');
    expect(runAdvice('yellow', 3, false).action).toBe('hold');
    expect(runAdvice('green', 6, false).action).toBe('hold');
    expect(runAdvice('green', 6, true).action).toBe('up');
    expect(runAdvice('green', 2, false).action).toBe('up');
  });
  it('repairs broken settings', () => {
    const s = normalizeSettings({ kneeGreenMax: 7, kneeYellowMax: 3, football: 'montag' as never, days: { A: 9, B: -1, C: 6 }, status: { x: 'quatsch' as never } });
    expect(s.kneeYellowMax).toBeGreaterThanOrEqual(s.kneeGreenMax);
    expect(s.football).toBe('thursday');
    expect(s.days).toEqual({ A: 6, B: 0, C: 6 });
    expect(s.status).toEqual({});
  });
});
