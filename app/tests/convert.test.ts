import { describe, expect, it } from 'vitest';
import { convertLegacy, isLegacyState, parseLegacyStorage } from '../src/legacy/convert';
import { TEMPLATE_IDS } from '../src/domain/templates';
import { LEGACY_STATE, NOW } from './fixtures';

describe('conversion of the previous single-file app', () => {
  const r = convertLegacy(LEGACY_STATE, { now: NOW });

  it('takes over completed workouts and drafts with real entries only', () => {
    expect(r.report.completedSessions).toBe(1);
    expect(r.report.draftSessions).toBe(1);
    expect(r.report.skippedEmpty).toBe(1);
    const done = r.sessions.find((s) => s.id === 'legacy-ses-a1')!;
    expect(done.status).toBe('completed');
    expect(done.kind).toBe('strength');
    expect(done.templateId).toBe(TEMPLATE_IDS.B);
    expect(done.rev).toBe(0);
  });

  it('keeps only plain numbers as repetitions and the rest word for word', () => {
    const bench = r.sessions.find((s) => s.id === 'legacy-ses-a1')!.exercises[0]!;
    expect(bench.exerciseId).toBe('strength-bench-press');
    expect(bench.sets.map((s) => [s.value, s.weightKg, s.done])).toEqual([[6, 80, true], [null, 80, true]]);
    expect(bench.note).toContain('„3 × 6“');
  });

  it('marks the knee value of the old app as inferred instead of guessing before/after', () => {
    const done = r.sessions.find((s) => s.id === 'legacy-ses-a1')!;
    expect(done.kneeAfter).toBe(3);
    expect(done.kneeBefore).toBeNull();
    expect(done.legacy?.inferred).toContain('kneeAfter');
  });

  it('skips broken entries with a message instead of failing', () => {
    expect(r.report.problems.some((p) => p.includes('ungültiges Datum'))).toBe(true);
    expect(r.knee).toHaveLength(1);
    expect(r.report.problems.some((p) => p.includes('Knie-Check #2'))).toBe(true);
  });

  it('takes over changed templates, own exercises and settings', () => {
    expect(r.templates.map((t) => t.id)).toEqual([TEMPLATE_IDS.C]);
    expect(r.customExercises.map((x) => x.name)).toEqual(['Meine Übung']);
    expect(r.templates[0]!.exercises.map((x) => x.exerciseId)).toEqual(['hyrox-skierg', r.customExercises[0]!.id, 'hyrox-farmers-carry']);
    expect(r.settings).toEqual({ football: 'sunday', partnerName: 'Alex' });
  });

  it('derives the same ids every time', () => {
    const again = convertLegacy(LEGACY_STATE, { now: new Date('2027-01-01') });
    expect(again.sessions.map((s) => s.id)).toEqual(r.sessions.map((s) => s.id));
    expect(again.knee.map((k) => k.id)).toEqual(r.knee.map((k) => k.id));
  });

  it('recognises the format and survives junk', () => {
    expect(isLegacyState(LEGACY_STATE)).toBe(true);
    expect(isLegacyState({ plans: 'x' })).toBe(false);
    const problems: string[] = [];
    expect(parseLegacyStorage('{kaputt', problems)).toBeNull();
    expect(problems).toHaveLength(1);
    expect(() => convertLegacy({ plans: [], sessions: [null, { status: 'done', date: '2026-10-01', items: 'x' }], checkins: [] } as never)).not.toThrow();
  });
});
