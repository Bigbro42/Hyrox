import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DEFAULT_SETTINGS, normalizeSettings } from '../domain/settings';
import type { ExerciseDef, KneeLog, PlannedWorkout, Settings, UserData, WorkoutSession, WorkoutTemplate } from '../domain/types';

/**
 * Own database name: FORM. runs on the same origin (bigbro42.github.io) and uses "form".
 * Both apps must never touch each other's data.
 */
export const DB_NAME = 'hyrox-trainer';
export const DB_VERSION = 1;

export type SnapshotKind = 'legacy-storage' | 'user-data';

export interface Snapshot {
  id: string;
  takenAt: string;
  kind: SnapshotKind;
  /** Why it was taken, shown to the user. */
  reason: string;
  /** JSON text: raw localStorage value of the previous app or a full backup. */
  payload: string;
}

export interface MergeOutcome {
  added: number;
  updated: number;
  /** Records changed here since; the incoming version was not applied. */
  keptLocal: number;
}

export interface LegacyImportState {
  hash: string;
  importedAt: string;
  report: import('../legacy/convert').ConversionReport;
  outcome: MergeOutcome;
}

interface KvValues {
  settings: Settings;
  legacyImport: LegacyImportState;
  /** Version of the standard content written on the first start (templates, standard week). */
  seeded: number;
}

interface HyroxDB extends DBSchema {
  sessions: { key: string; value: WorkoutSession; indexes: { date: string } };
  plans: { key: string; value: PlannedWorkout };
  templates: { key: string; value: WorkoutTemplate };
  exercises: { key: string; value: ExerciseDef };
  knee: { key: string; value: KneeLog; indexes: { date: string } };
  snapshots: { key: string; value: Snapshot; indexes: { takenAt: string } };
  kv: { key: keyof KvValues; value: KvValues[keyof KvValues] };
}

export type Db = IDBPDatabase<HyroxDB>;

export function openHyroxDb(name = DB_NAME): Promise<Db> {
  return openDB<HyroxDB>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Future schema versions add `if (oldVersion < N)` steps; existing stores are never dropped.
      if (oldVersion < 1) {
        db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('date', 'date');
        db.createObjectStore('plans', { keyPath: 'id' });
        db.createObjectStore('templates', { keyPath: 'id' });
        db.createObjectStore('exercises', { keyPath: 'id' });
        db.createObjectStore('knee', { keyPath: 'id' }).createIndex('date', 'date');
        db.createObjectStore('snapshots', { keyPath: 'id' }).createIndex('takenAt', 'takenAt');
        db.createObjectStore('kv');
      }
    },
    blocking() {
      // Another tab wants a newer schema: let it, this tab reloads into the new version.
      location.reload();
    },
  });
}

export async function getKv<K extends keyof KvValues>(db: Db, key: K): Promise<KvValues[K] | undefined> {
  return (await db.get('kv', key)) as KvValues[K] | undefined;
}

export async function setKv<K extends keyof KvValues>(db: Db, key: K, value: KvValues[K]): Promise<void> {
  await db.put('kv', value, key);
}

const USER_STORES = ['sessions', 'plans', 'templates', 'exercises', 'knee'] as const;

export async function readUserData(db: Db): Promise<UserData> {
  const tx = db.transaction([...USER_STORES, 'kv'], 'readonly');
  const [sessions, plans, templates, customExercises, knee, settings] = await Promise.all([
    tx.objectStore('sessions').getAll(),
    tx.objectStore('plans').getAll(),
    tx.objectStore('templates').getAll(),
    tx.objectStore('exercises').getAll(),
    tx.objectStore('knee').getAll(),
    tx.objectStore('kv').get('settings') as Promise<Settings | undefined>,
  ]);
  await tx.done;
  sessions.sort((a, b) => b.date.localeCompare(a.date) || (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  knee.sort((a, b) => a.at.localeCompare(b.at));
  return { sessions, plans, templates, customExercises, knee, settings: normalizeSettings(settings) };
}

interface Revisioned {
  id: string;
  rev: number;
  updatedAt: string;
}

/**
 * How incoming records treat records that already exist with the same id:
 * - refresh:     live re-import from the previous app. Untouched imports (rev 0) are refreshed;
 *                anything changed here (rev > 0) is kept.
 * - newer-wins:  backup merge. The more recently updated version wins.
 * - add-missing: backup of the previous app. Only new records are added.
 * - replace:     the stores were emptied first; everything incoming is written.
 */
export type MergePolicy = 'refresh' | 'newer-wins' | 'add-missing' | 'replace';

function incomingWins(policy: MergePolicy, existing: Revisioned, item: Revisioned): boolean {
  switch (policy) {
    case 'replace': return true;
    case 'refresh': return existing.rev === 0;
    case 'newer-wins': return item.updatedAt > existing.updatedAt;
    case 'add-missing': return false;
  }
}

async function mergeInto<T extends Revisioned>(store: { get(id: string): Promise<T | undefined>; put(v: T): Promise<unknown> }, items: readonly T[], policy: MergePolicy, out: MergeOutcome) {
  for (const item of items) {
    const existing = await store.get(item.id);
    if (!existing) {
      await store.put(item);
      out.added++;
    } else if (JSON.stringify(existing) === JSON.stringify(item)) {
      // identical, nothing to do
    } else if (incomingWins(policy, existing, item)) {
      await store.put(item);
      out.updated++;
    } else {
      out.keptLocal++;
    }
  }
}

export interface MergeInput {
  sessions: WorkoutSession[];
  plans?: PlannedWorkout[];
  templates?: WorkoutTemplate[];
  customExercises?: ExerciseDef[];
  knee?: KneeLog[];
  settings?: Partial<Settings>;
}

/**
 * Writes incoming data in one transaction: either everything is stored or nothing.
 * `replace` empties the user stores first (callers take a snapshot before).
 */
export async function mergeUserData(db: Db, input: MergeInput, policy: MergePolicy): Promise<MergeOutcome> {
  const out: MergeOutcome = { added: 0, updated: 0, keptLocal: 0 };
  const tx = db.transaction([...USER_STORES, 'kv'], 'readwrite');
  const overwrite = policy === 'replace';
  if (overwrite) await Promise.all(USER_STORES.map((s) => tx.objectStore(s).clear()));
  await mergeInto(tx.objectStore('sessions'), input.sessions, policy, out);
  await mergeInto(tx.objectStore('plans'), input.plans ?? [], policy, out);
  await mergeInto(tx.objectStore('templates'), input.templates ?? [], policy, out);
  await mergeInto(tx.objectStore('knee'), input.knee ?? [], policy, out);
  for (const x of input.customExercises ?? []) {
    // Own exercises are only ever added; an id that exists already keeps its definition.
    if (overwrite || !(await tx.objectStore('exercises').get(x.id))) await tx.objectStore('exercises').put(x);
  }
  if (input.settings && Object.keys(input.settings).length) {
    const kv = tx.objectStore('kv');
    const current = normalizeSettings((await kv.get('settings')) as Settings | undefined);
    // Settings changed here are never overwritten by a merge.
    const touched = current.updatedAt !== DEFAULT_SETTINGS.updatedAt;
    if (overwrite) await kv.put(normalizeSettings(input.settings), 'settings');
    else if (!touched) await kv.put(normalizeSettings({ ...current, ...input.settings, updatedAt: current.updatedAt }), 'settings');
  }
  await tx.done;
  return out;
}

export async function saveSnapshot(db: Db, snapshot: Snapshot, keepPerKind = 10): Promise<void> {
  const tx = db.transaction('snapshots', 'readwrite');
  await tx.store.put(snapshot);
  const all = (await tx.store.index('takenAt').getAll()).filter((s) => s.kind === snapshot.kind);
  // Keep the very first snapshot of each kind (the original state) plus the newest ones.
  const removable = all.slice(1, Math.max(1, all.length - keepPerKind + 1));
  for (const s of removable) await tx.store.delete(s.id);
  await tx.done;
}

export async function listSnapshots(db: Db): Promise<Snapshot[]> {
  return (await db.getAllFromIndex('snapshots', 'takenAt')).reverse();
}

/**
 * Deletes all training data on this device. The record of the import from the previous app is
 * kept, so its data is not imported again on the next start; snapshots stay unless requested.
 */
export async function clearUserData(db: Db, snapshots = false): Promise<void> {
  const tx = db.transaction([...USER_STORES, 'kv', 'snapshots'], 'readwrite');
  await Promise.all(USER_STORES.map((s) => tx.objectStore(s).clear()));
  await Promise.all([tx.objectStore('kv').delete('settings'), tx.objectStore('kv').delete('seeded')]);
  if (snapshots) await tx.objectStore('snapshots').clear();
  await tx.done;
}
