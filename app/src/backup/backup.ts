import { listSnapshots, mergeUserData, readUserData, saveSnapshot, type Db, type MergeOutcome, type MergePolicy } from '../db/db';
import { isIsoDate } from '../domain/dates';
import { newId } from '../domain/ids';
import { validPain } from '../domain/knee';
import { KIND_LABELS } from '../domain/templates';
import type { ExerciseDef, KneeLog, PlannedWorkout, UserData, WorkoutSession, WorkoutTemplate } from '../domain/types';
import { convertLegacy, isLegacyState, type ConversionReport } from '../legacy/convert';

export const BACKUP_FORMAT = 'hyrox-trainer-backup';
export const BACKUP_SCHEMA = 1;
const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  app: 'HYROX Trainer';
  exportedAt: string;
  data: UserData;
  /** Untouched localStorage value of the previous app from the latest import, so nothing is ever lost. */
  legacyRaw: Record<string, string> | null;
}

export async function createBackup(db: Db, now = new Date()): Promise<BackupFile> {
  const data = await readUserData(db);
  const legacy = (await listSnapshots(db)).find((s) => s.kind === 'legacy-storage');
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA,
    app: 'HYROX Trainer',
    exportedAt: now.toISOString(),
    data,
    legacyRaw: legacy ? (JSON.parse(legacy.payload) as Record<string, string>) : null,
  };
}

export interface ParsedRecords {
  sessions: WorkoutSession[];
  plans: PlannedWorkout[];
  templates: WorkoutTemplate[];
  knee: KneeLog[];
  customExercises: ExerciseDef[];
  settings: Partial<UserData['settings']>;
}

export type ParsedBackup =
  | ({ kind: 'hyrox'; exportedAt: string; skipped: string[] } & ParsedRecords)
  | ({ kind: 'legacy'; report: ConversionReport } & ParsedRecords);

export class BackupError extends Error {}

const STATUSES = new Set(['active', 'draft', 'completed']);
const KINDS = new Set(Object.keys(KIND_LABELS));
const obj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const isStr = (x: unknown): x is string => typeof x === 'string';
const nullableNum = (x: unknown) => x === null || (typeof x === 'number' && Number.isFinite(x));

function validSet(s: unknown): boolean {
  return obj(s) && isStr(s.id) && nullableNum(s.value) && nullableNum(s.weightKg) && nullableNum(s.timeSec ?? null) && typeof s.done === 'boolean';
}

export function validSession(s: unknown): s is WorkoutSession {
  if (!obj(s)) return false;
  return isStr(s.id) && isIsoDate(s.date) && isStr(s.title) && STATUSES.has(s.status as string) && KINDS.has(s.kind as string)
    && Array.isArray(s.exercises) && s.exercises.every((e) => obj(e) && isStr(e.id) && isStr(e.exerciseId) && isStr(e.name) && isStr(e.metric) && Array.isArray(e.sets) && e.sets.every(validSet))
    && (s.kneeBefore === null || validPain(s.kneeBefore)) && (s.kneeAfter === null || validPain(s.kneeAfter))
    && typeof s.rev === 'number' && isStr(s.updatedAt);
}

function validPlan(p: unknown): p is PlannedWorkout {
  return obj(p) && isStr(p.id) && isStr(p.title) && isIsoDate(p.startsOn) && obj(p.recurrence) && isStr(p.recurrence.freq) && obj(p.exceptions) && KINDS.has(p.kind as string) && typeof p.rev === 'number';
}

function validTemplate(t: unknown): t is WorkoutTemplate {
  return obj(t) && isStr(t.id) && isStr(t.name) && KINDS.has(t.kind as string) && typeof t.minutes === 'number' && Array.isArray(t.exercises)
    && t.exercises.every((x) => obj(x) && isStr(x.exerciseId) && typeof x.sets === 'number') && typeof t.rev === 'number';
}

function validKnee(k: unknown): k is KneeLog {
  return obj(k) && isStr(k.id) && isIsoDate(k.date) && isStr(k.at) && validPain(k.pain) && isStr(k.context) && typeof k.rev === 'number';
}

function validExercise(x: unknown): x is ExerciseDef {
  return obj(x) && isStr(x.id) && isStr(x.name) && isStr(x.metric) && isStr(x.category) && Array.isArray(x.primaryMuscles) && x.source === 'custom';
}

function keep<T>(list: unknown, valid: (x: unknown) => x is T, label: string, skipped: string[]): T[] {
  if (!Array.isArray(list)) return [];
  return list.filter((x, i): x is T => valid(x) || (skipped.push(`${label} #${i + 1}`), false));
}

/** Accepts backups of this app and JSON backups of the previous single-file app. */
export function parseBackup(text: string, fileName: string, now = new Date()): ParsedBackup {
  if (text.length > MAX_BACKUP_BYTES) throw new BackupError('Die Datei ist größer als 50 MB und wird nicht importiert.');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('Die Datei ist kein gültiges JSON. Bitte wähle ein HYROX-Trainer-Backup aus.');
  }
  if (obj(data) && data.format === BACKUP_FORMAT) {
    const file = data as unknown as BackupFile;
    if (typeof file.schemaVersion !== 'number' || file.schemaVersion > BACKUP_SCHEMA) {
      throw new BackupError('Dieses Backup stammt aus einer neueren App-Version. Bitte aktualisiere die App zuerst.');
    }
    if (!obj(file.data) || !Array.isArray(file.data.sessions)) throw new BackupError('Das Backup ist unvollständig: Die Trainings fehlen.');
    const skipped: string[] = [];
    return {
      kind: 'hyrox',
      exportedAt: isStr(file.exportedAt) ? file.exportedAt : '',
      sessions: keep(file.data.sessions, validSession, 'Training', skipped),
      plans: keep(file.data.plans, validPlan, 'Termin', skipped),
      templates: keep(file.data.templates, validTemplate, 'Vorlage', skipped),
      knee: keep(file.data.knee, validKnee, 'Knie-Check', skipped),
      customExercises: keep(file.data.customExercises, validExercise, 'Eigene Übung', skipped),
      settings: obj(file.data.settings) ? file.data.settings : {},
      skipped,
    };
  }
  if (isLegacyState(data)) {
    const r = convertLegacy(data, { now, origin: fileName });
    return { kind: 'legacy', sessions: r.sessions, plans: [], templates: r.templates, knee: r.knee, customExercises: r.customExercises, settings: r.settings, report: r.report };
  }
  throw new BackupError('Diese Datei ist kein HYROX-Trainer-Backup.');
}

/**
 * Imports a parsed backup. A full snapshot of the current data is stored first, so the previous
 * state can always be downloaded again.
 */
export async function importBackup(db: Db, parsed: ParsedBackup, mode: 'merge' | 'replace', fileName: string, now = new Date()): Promise<MergeOutcome> {
  const policy: MergePolicy = mode === 'replace' ? 'replace' : parsed.kind === 'hyrox' ? 'newer-wins' : 'add-missing';
  const before = await createBackup(db, now);
  await saveSnapshot(db, {
    id: newId('snap'),
    takenAt: now.toISOString(),
    kind: 'user-data',
    reason: `Vor dem Import von „${fileName}“`,
    payload: JSON.stringify(before),
  });
  return mergeUserData(db, parsed, policy);
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

const STATUS_LABEL: Record<WorkoutSession['status'], string> = { completed: 'Abgeschlossen', draft: 'Nicht abgeschlossen', active: 'Läuft' };

/** One row per set; semicolon separated with BOM so Excel (de) opens it correctly. */
export function sessionsToCsv(sessions: readonly WorkoutSession[]): string {
  const rows: unknown[][] = [['Datum', 'Training', 'Art', 'Status', 'Dauer (Min.)', 'Belastung (RPE)', 'Knie vorher', 'Knie nachher', 'Übung', 'Übungs-ID', 'Satz', 'Wert', 'Einheit', 'Gewicht (kg)', 'Zeit (Sek.)', 'Abgehakt', 'Notiz']];
  const unit: Record<string, string> = { reps: 'Wdh.', seconds: 'Sek.', minutes: 'Min.', meters: 'm' };
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    const base = [s.date, s.title, KIND_LABELS[s.kind], STATUS_LABEL[s.status], s.durationMin, s.rpe, s.kneeBefore, s.kneeAfter];
    if (!s.exercises.length) rows.push([...base, '', '', '', '', '', '', '', '', s.note]);
    for (const x of s.exercises) {
      x.sets.forEach((set, i) => rows.push([...base, x.name, x.exerciseId, i + 1, set.value, unit[x.metric], set.weightKg, set.timeSec, set.done ? 'Ja' : 'Nein', i === 0 ? [s.note, x.note].filter(Boolean).join(' | ') : '']));
    }
  }
  return '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
}

/** Knee values as a separate table (date, time, value, context). */
export function kneeToCsv(points: readonly { date: string; at: string; pain: number; source: string }[]): string {
  const rows: unknown[][] = [['Datum', 'Zeitpunkt', 'Knieschmerz (0–10)', 'Art']];
  for (const p of points) rows.push([p.date, p.at, p.pain, p.source]);
  return '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
}
