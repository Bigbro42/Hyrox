/** The three standard units of the week. They can be edited and reset to these defaults. */
import type { IsoDateTime, PlannedExercise, SessionKind, WorkoutTemplate } from './types';

export const TEMPLATE_IDS = { A: 'tpl-physio', B: 'tpl-strength', C: 'tpl-hyrox' } as const;

interface DefaultTemplate {
  id: string;
  name: string;
  kind: SessionKind;
  minutes: number;
  exercises: PlannedExercise[];
}

const ex = (exerciseId: string, sets: number): PlannedExercise => ({ exerciseId, sets });

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    id: TEMPLATE_IDS.A,
    name: 'Physio & Knie-Stabilität',
    kind: 'physio',
    minutes: 45,
    exercises: [
      ex('cardio-bike-easy', 1),
      ex('physio-spanish-squat', 3),
      ex('physio-copenhagen', 2),
      ex('physio-sl-hamstring-bridge', 2),
      ex('physio-seated-leg-raise', 2),
      ex('physio-seated-hip-ir', 2),
      ex('physio-tibialis-rotation', 2),
      ex('mobility-hip-flexor', 2),
    ],
  },
  {
    id: TEMPLATE_IDS.B,
    name: 'Kraft & Ausdauer',
    kind: 'strength',
    minutes: 55,
    exercises: [
      ex('cardio-bike-easy', 1),
      ex('strength-rdl', 3),
      ex('strength-bench-press', 3),
      ex('strength-cable-row', 3),
      ex('strength-overhead-press', 3),
      ex('strength-glute-bridge', 2),
      ex('cardio-bike-intervals', 1),
    ],
  },
  {
    id: TEMPLATE_IDS.C,
    name: 'HYROX Mixed Doubles',
    kind: 'hyrox',
    minutes: 60,
    exercises: [
      ex('cardio-bike-easy', 1),
      ex('hyrox-skierg', 4),
      ex('hyrox-rowerg', 4),
      ex('hyrox-farmers-carry', 4),
      ex('hyrox-sled-pull', 4),
      ex('core-plank', 2),
    ],
  },
];

export function defaultTemplate(id: string, now: IsoDateTime): WorkoutTemplate | null {
  const t = DEFAULT_TEMPLATES.find((x) => x.id === id);
  return t ? { ...t, exercises: t.exercises.map((x) => ({ ...x })), rev: 1, updatedAt: now } : null;
}

export function defaultTemplates(now: IsoDateTime): WorkoutTemplate[] {
  return DEFAULT_TEMPLATES.map((t) => defaultTemplate(t.id, now)!);
}

export const KIND_LABELS: Record<SessionKind, string> = {
  physio: 'Physio', strength: 'Kraft & Ausdauer', hyrox: 'HYROX', football: 'Fußball', free: 'Freies Training',
};

/** Kinds that count as an intensive day (football is a full match or training). */
export const INTENSIVE_KINDS: SessionKind[] = ['strength', 'hyrox', 'football'];
