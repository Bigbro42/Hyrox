/**
 * Converts data of the previous single-file HYROX app (localStorage `form-hyrox-trainer-v1`, also
 * its JSON backups) into the new model. Pure functions, never throws on broken entries.
 *
 * Rules:
 * - Only sessions marked "done" become completed workouts. Started ones with entered values
 *   become "not completed"; started ones without any entry are not taken over.
 * - The old app pre-filled the repetition field with the target text ("3 × 8"). Only plain
 *   numbers become repetitions; any other text is kept word for word in the exercise note.
 * - The old app stored one knee value per workout without saying when; it is taken over as the
 *   value after the workout and marked as inferred.
 * - Ids are derived from the old ids, so the same data from localStorage and from a backup file
 *   never appears twice.
 * - Templates are only taken over if they were changed compared with the old defaults.
 */
import { builtin, LEGACY_NAMES } from '../domain/catalog';
import { isIsoDate, parseDate } from '../domain/dates';
import { emptySet } from '../domain/session';
import { TEMPLATE_IDS } from '../domain/templates';
import type { ExerciseDef, FootballDay, KneeLog, SessionExercise, SessionKind, Settings, SetEntry, WorkoutSession, WorkoutTemplate } from '../domain/types';

export const LEGACY_KEY = 'form-hyrox-trainer-v1';

export interface ConversionReport {
  origin: string;
  completedSessions: number;
  draftSessions: number;
  skippedEmpty: number;
  kneeLogs: number;
  templates: number;
  customExercises: number;
  problems: string[];
}

export interface Converted {
  sessions: WorkoutSession[];
  templates: WorkoutTemplate[];
  knee: KneeLog[];
  customExercises: ExerciseDef[];
  settings: Partial<Settings>;
  report: ConversionReport;
}

interface OldSet { reps?: unknown; kg?: unknown; done?: unknown }
interface OldItem { name?: unknown; sets?: unknown }
interface OldSession { id?: unknown; plan?: unknown; name?: unknown; type?: unknown; date?: unknown; duration?: unknown; rpe?: unknown; pain?: unknown; note?: unknown; status?: unknown; items?: unknown }
interface OldPlan { id?: unknown; name?: unknown; mins?: unknown; items?: unknown }
interface OldState { plans?: unknown; sessions?: unknown; checkins?: unknown; custom?: unknown; football?: unknown; partner?: unknown }

const OLD_DEFAULT_PLANS: Record<string, { template: string; items: string[] }> = {
  P: { template: TEMPLATE_IDS.A, items: ['Radfahren locker', 'Spanish Squat', 'Copenhagen Plank', 'SL Hamstring Bridge isometrisch', 'Seated Leg Raise', 'Seated Hip Internal Rotation', 'Tibialis Rotation'] },
  A: { template: TEMPLATE_IDS.B, items: ['Radfahren locker', 'Rumänisches Kreuzheben', 'Bankdrücken', 'Kabelrudern', 'Glute Bridge'] },
  C: { template: TEMPLATE_IDS.C, items: ['SkiErg', 'RowErg', 'Farmers Carry', 'Kabelrudern', 'Radfahren locker'] },
};

const KIND_BY_TYPE: Record<string, SessionKind> = { Physio: 'physio', Kraft: 'strength', HYROX: 'hyrox' };

/** Whether parsed JSON looks like the previous app's state or one of its backups. */
export function isLegacyState(data: unknown): data is OldState {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as OldState;
  return Array.isArray(d.plans) && Array.isArray(d.sessions) && Array.isArray(d.checkins);
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

function slug(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'uebung';
}

/** Plain numbers only ("8", "12,5"); everything else is not a measurement. */
function plainNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

function customExercise(name: string, now: string): ExerciseDef {
  return {
    id: `legacy-ex-${slug(name)}`,
    name,
    aliases: [],
    category: 'strength',
    metric: 'reps',
    timed: false,
    weighted: true,
    primaryMuscles: [],
    secondaryMuscles: [],
    equipment: [],
    level: 1,
    kneeLoad: 'medium',
    tier: 'optional',
    dose: '',
    sets: 3,
    restSeconds: 90,
    description: 'Eigene Übung aus der bisherigen App.',
    steps: [],
    mistakes: [],
    safety: '',
    easier: '',
    harder: '',
    media: null,
    source: 'custom',
    createdAt: now,
  };
}

function localNoon(date: string): string {
  return parseDate(date).toISOString();
}

export function convertLegacy(data: OldState, opts: { now?: Date; origin?: string } = {}): Converted {
  const now = (opts.now ?? new Date()).toISOString();
  const origin = opts.origin ?? LEGACY_KEY;
  const report: ConversionReport = { origin, completedSessions: 0, draftSessions: 0, skippedEmpty: 0, kneeLogs: 0, templates: 0, customExercises: 0, problems: [] };
  const customs = new Map<string, ExerciseDef>();

  const resolve = (name: string): ExerciseDef => {
    const id = LEGACY_NAMES[name];
    const def = id ? builtin(id) : undefined;
    if (def) return def;
    const key = `legacy-ex-${slug(name)}`;
    if (!customs.has(key)) customs.set(key, customExercise(name, now));
    return customs.get(key)!;
  };

  for (const n of Array.isArray(data.custom) ? data.custom : []) {
    const name = str(n, 100).trim();
    if (name) resolve(name);
  }

  const sessions: WorkoutSession[] = [];
  const oldSessions = Array.isArray(data.sessions) ? data.sessions as OldSession[] : [];
  oldSessions.forEach((s, i) => {
    if (typeof s !== 'object' || s === null) return void report.problems.push(`Training #${i + 1}: kein gültiger Eintrag`);
    const date = str(s.date, 10);
    if (!isIsoDate(date)) return void report.problems.push(`Training #${i + 1}: ungültiges Datum`);
    const ref = str(s.id, 80) || `${date}-${i}`;
    const notes: string[] = [];
    let hasData = false;
    const exercises: SessionExercise[] = [];
    for (const [j, raw] of (Array.isArray(s.items) ? s.items as OldItem[] : []).entries()) {
      const name = str(raw?.name, 100).trim();
      if (!name) continue;
      const def = resolve(name);
      const texts: string[] = [];
      const sets: SetEntry[] = (Array.isArray(raw.sets) ? raw.sets as OldSet[] : []).map((o, k) => {
        const value = plainNumber(o?.reps);
        const weightKg = plainNumber(o?.kg);
        const done = o?.done === true;
        const repsText = str(o?.reps, 60).trim();
        if (value === null && repsText) texts.push(`S${k + 1} „${repsText}“${weightKg !== null ? `, ${weightKg} kg` : ''}`);
        if (value !== null || weightKg !== null || done) hasData = true;
        return { ...emptySet(), id: `legacy-set-${ref}-${j}-${k}`, value, weightKg, done };
      });
      exercises.push({
        id: `legacy-ex-${ref}-${j}`,
        exerciseId: def.id,
        name: def.name,
        metric: def.metric,
        timed: def.timed,
        sets: sets.length ? sets : [{ ...emptySet(), id: `legacy-set-${ref}-${j}-0` }],
        ...(texts.length ? { note: `Eintrag der bisherigen App: ${texts.join(' · ')}` } : {}),
      });
    }
    const done = s.status === 'done';
    if (!done && !hasData) {
      report.skippedEmpty++;
      return;
    }
    const pain = typeof s.pain === 'number' && Number.isInteger(s.pain) && s.pain >= 0 && s.pain <= 10 ? s.pain : null;
    const rpe = typeof s.rpe === 'number' && s.rpe >= 1 && s.rpe <= 10 ? Math.round(s.rpe) : null;
    const duration = typeof s.duration === 'number' && s.duration > 0 && s.duration <= 600 ? Math.round(s.duration) : null;
    const plan = str(s.plan, 10);
    const note = str(s.note, 2000);
    if (pain !== null) notes.push('Kniewert der bisherigen App (Zeitpunkt nicht gespeichert) als Wert nach dem Training übernommen.');
    sessions.push({
      id: `legacy-ses-${ref}`,
      date,
      title: str(s.name, 100) || 'Training',
      kind: KIND_BY_TYPE[str(s.type)] ?? 'free',
      templateId: OLD_DEFAULT_PLANS[plan]?.template ?? null,
      status: done ? 'completed' : 'draft',
      source: 'legacy',
      exercises,
      startedAt: null,
      completedAt: done ? localNoon(date) : null,
      durationMin: duration,
      rpe,
      kneeBefore: null,
      kneeAfter: pain,
      note: [note, ...notes].filter(Boolean).join('\n'),
      legacy: { key: origin, ref, inferred: done ? ['completedAt', ...(pain !== null ? ['kneeAfter'] : [])] : undefined },
      rev: 0,
      updatedAt: now,
    });
    if (done) report.completedSessions++;
    else report.draftSessions++;
  });

  const knee: KneeLog[] = [];
  (Array.isArray(data.checkins) ? data.checkins : []).forEach((c: { date?: unknown; pain?: unknown; energy?: unknown }, i) => {
    const date = str(c?.date, 10);
    if (!isIsoDate(date) || typeof c.pain !== 'number' || !Number.isInteger(c.pain) || c.pain < 0 || c.pain > 10) {
      report.problems.push(`Knie-Check #${i + 1}: ungültiger Wert`);
      return;
    }
    const energy = typeof c.energy === 'number' && c.energy >= 1 && c.energy <= 5 ? `Energie ${c.energy}/5` : '';
    knee.push({ id: `legacy-knee-${date}-${i}`, date, at: localNoon(date), pain: c.pain, context: 'check', note: energy, legacy: { key: origin, ref: `checkin-${i}`, inferred: ['at'] }, rev: 0, updatedAt: now });
  });
  report.kneeLogs = knee.length;

  const templates: WorkoutTemplate[] = [];
  for (const p of Array.isArray(data.plans) ? data.plans as OldPlan[] : []) {
    const old = OLD_DEFAULT_PLANS[str(p?.id, 10)];
    const items = (Array.isArray(p?.items) ? p.items : []).map((x) => str(x, 100)).filter(Boolean);
    if (!old || !items.length || JSON.stringify(items) === JSON.stringify(old.items)) continue;
    templates.push({
      id: old.template,
      name: str(p.name, 100) || 'Training',
      kind: old.template === TEMPLATE_IDS.A ? 'physio' : old.template === TEMPLATE_IDS.B ? 'strength' : 'hyrox',
      minutes: typeof p.mins === 'number' && p.mins >= 5 && p.mins <= 240 ? Math.round(p.mins) : 55,
      exercises: items.map((name) => {
        const def = resolve(name);
        return { exerciseId: def.id, sets: def.sets };
      }),
      rev: 0,
      updatedAt: now,
    });
  }
  report.templates = templates.length;

  const settings: Partial<Settings> = {};
  const football: Record<string, FootballDay> = { Donnerstag: 'thursday', Sonntag: 'sunday', pausiert: 'none' };
  if (football[str(data.football)]) settings.football = football[str(data.football)];
  if (str(data.partner, 60).trim()) settings.partnerName = str(data.partner, 60).trim();

  const customExercises = [...customs.values()];
  report.customExercises = customExercises.length;
  return { sessions, templates, knee, customExercises, settings, report };
}

/** Parses the raw localStorage value; broken JSON yields null and a problem entry. */
export function parseLegacyStorage(raw: string | null, problems: string[]): OldState | null {
  if (raw === null) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (isLegacyState(data)) return data;
    problems.push('Die gespeicherten Daten der bisherigen App haben ein unbekanntes Format.');
  } catch {
    problems.push('Die gespeicherten Daten der bisherigen App sind kein gültiges JSON.');
  }
  return null;
}
