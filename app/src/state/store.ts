import { useEffect, useState } from 'preact/hooks';
import { getKv, listSnapshots, openHyroxDb, readUserData, setKv, type Db, type LegacyImportState, type Snapshot } from '../db/db';
import { syncStandardWeek } from '../domain/calendar';
import { today } from '../domain/dates';
import { DEFAULT_SETTINGS, normalizeSettings } from '../domain/settings';
import { defaultTemplates } from '../domain/templates';
import type { ExerciseDef, KneeLog, PlannedWorkout, Settings, UserData, WorkoutSession, WorkoutTemplate } from '../domain/types';
import { runLegacyMigration, type MigrationResult } from '../legacy/migrate';

export type PersistState = 'persisted' | 'not-persisted' | 'unsupported';

export interface AppState {
  phase: 'loading' | 'ready' | 'error';
  error: string | null;
  data: UserData;
  legacy: LegacyImportState | null;
  /** Result of the migration run at this start (for the one-time notice). */
  migration: MigrationResult | null;
  snapshots: Snapshot[];
  persist: PersistState;
  /** Running rest timer, if any. */
  rest: { endsAt: number; total: number } | null;
}

/** Version of the standard content (templates, standard week) written on the first start. */
const SEED_VERSION = 1;

let db: Db | null = null;
let state: AppState = {
  phase: 'loading',
  error: null,
  data: { sessions: [], plans: [], templates: [], customExercises: [], knee: [], settings: DEFAULT_SETTINGS },
  legacy: null,
  migration: null,
  snapshots: [],
  persist: 'unsupported',
  rest: null,
};
const listeners = new Set<() => void>();

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function getDb(): Db {
  if (!db) throw new Error('Datenbank ist noch nicht geöffnet.');
  return db;
}

export function useAppState(): AppState {
  const [, force] = useState(0);
  const rendered = state;
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    // The state may have changed between render and subscription (e.g. a fast start from cache).
    if (rendered !== state) l();
    return () => void listeners.delete(l);
  }, []);
  return state;
}

/** Re-reads everything from IndexedDB after a write. */
export async function refresh(): Promise<void> {
  const d = getDb();
  const [data, legacy, snapshots] = await Promise.all([readUserData(d), getKv(d, 'legacyImport'), listSnapshots(d)]);
  set({ data, legacy: legacy ?? null, snapshots });
}

async function persistState(request: boolean): Promise<PersistState> {
  const storage = navigator.storage;
  if (!storage?.persisted) return 'unsupported';
  if (await storage.persisted()) return 'persisted';
  // Ask the browser to protect our data from automatic eviction (important on iOS Safari).
  if (request && storage.persist && (await storage.persist())) return 'persisted';
  return 'not-persisted';
}

function readableError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'InvalidStateError' || name === 'SecurityError') {
    return 'Dieser Browser erlaubt hier keine lokale Datenbank (z. B. im privaten Modus). Öffne die App in einem normalen Safari-Fenster oder als Home-Bildschirm-App.';
  }
  if (name === 'QuotaExceededError') return 'Der Speicher des Geräts ist voll. Bitte gib Speicherplatz frei und öffne die App erneut.';
  return `Die App konnte die Daten nicht laden (${(e as Error)?.message ?? String(e)}). Deine bisherigen Daten wurden nicht verändert.`;
}

/**
 * First start: writes the three standard templates (only ids that do not exist yet, e.g. not
 * over templates taken over from the previous app) and the standard week.
 */
async function seed(d: Db): Promise<void> {
  if (((await getKv(d, 'seeded')) ?? 0) >= SEED_VERSION) return;
  const now = new Date();
  const tx = d.transaction('templates', 'readwrite');
  for (const t of defaultTemplates(now.toISOString())) if (!(await tx.store.get(t.id))) await tx.store.put(t);
  await tx.done;
  const data = await readUserData(d);
  const changes = syncStandardWeek(data.plans, data.templates, data.settings, today(now), now);
  const ptx = d.transaction('plans', 'readwrite');
  await Promise.all([...changes.save.map((p) => ptx.store.put(p)), ...changes.remove.map((id) => ptx.store.delete(id)), ptx.done]);
  await setKv(d, 'seeded', SEED_VERSION);
}

export async function start(): Promise<void> {
  try {
    db = await openHyroxDb();
    let migration: MigrationResult | null = null;
    try {
      migration = await runLegacyMigration(db, localStorage);
    } catch (e) {
      // A failed import must never block the app; the old data stays untouched in localStorage.
      console.error('Legacy import failed', e);
      set({ error: `Die Übernahme aus der bisherigen App ist fehlgeschlagen: ${(e as Error).message}. Die alten Daten sind unverändert.` });
    }
    await seed(db);
    await refresh();
    set({ phase: 'ready', migration });
    const hasData = state.data.sessions.length > 0 || state.data.knee.length > 0;
    // Never block the start on this: browsers may delay or prompt before answering.
    persistState(hasData).then((persist) => set({ persist }), () => undefined);
  } catch (e) {
    console.error(e);
    set({ phase: 'error', error: readableError(e) });
  }
}

/** After deleting all data: writes the standard templates and week again and reloads. */
export async function reseed(): Promise<void> {
  await seed(getDb());
  await refresh();
}

export async function requestPersist(): Promise<void> {
  set({ persist: await persistState(true) });
}

export function dismissError() {
  set({ error: null });
}

function sortSessions(list: WorkoutSession[]): WorkoutSession[] {
  return list.sort((a, b) => b.date.localeCompare(a.date) || (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt));
}

let writes: Promise<unknown> = Promise.resolve();

/** Serialises writes so a slower earlier write can never overwrite a newer one. */
function enqueue(task: () => Promise<unknown>): Promise<void> {
  const next = writes.then(task);
  writes = next.catch(() => undefined);
  return next.then(
    () => undefined,
    (e) => {
      console.error(e);
      set({ error: `Speichern fehlgeschlagen: ${(e as Error).message}. Bitte sichere ein Backup unter „Daten & Backup“.` });
    },
  );
}

/** Autosave: updates the screen immediately and writes to IndexedDB in the background. */
export function saveSession(session: WorkoutSession): Promise<void> {
  const others = state.data.sessions.filter((s) => s.id !== session.id);
  set({ data: { ...state.data, sessions: sortSessions([...others, session]) } });
  if (state.persist === 'not-persisted') void requestPersist();
  return enqueue(() => getDb().put('sessions', session));
}

export function deleteSession(id: string): Promise<void> {
  set({ data: { ...state.data, sessions: state.data.sessions.filter((s) => s.id !== id) } });
  return enqueue(() => getDb().delete('sessions', id));
}

export function saveKneeLog(log: KneeLog): Promise<void> {
  const knee = [...state.data.knee.filter((k) => k.id !== log.id), log].sort((a, b) => a.at.localeCompare(b.at));
  set({ data: { ...state.data, knee } });
  if (state.persist === 'not-persisted') void requestPersist();
  return enqueue(() => getDb().put('knee', log));
}

export function deleteKneeLog(id: string): Promise<void> {
  set({ data: { ...state.data, knee: state.data.knee.filter((k) => k.id !== id) } });
  return enqueue(() => getDb().delete('knee', id));
}

export function savePlans(plans: readonly PlannedWorkout[], remove: readonly string[] = []): Promise<void> {
  const ids = new Set([...plans.map((p) => p.id), ...remove]);
  set({ data: { ...state.data, plans: [...state.data.plans.filter((p) => !ids.has(p.id)), ...plans] } });
  return enqueue(async () => {
    const tx = getDb().transaction('plans', 'readwrite');
    await Promise.all([...plans.map((p) => tx.store.put(p)), ...remove.map((id) => tx.store.delete(id)), tx.done]);
  });
}

export function saveTemplate(t: WorkoutTemplate): Promise<void> {
  const templates = [...state.data.templates.filter((x) => x.id !== t.id), t];
  set({ data: { ...state.data, templates } });
  return enqueue(() => getDb().put('templates', t));
}

export function saveCustomExercise(x: ExerciseDef): Promise<void> {
  const list = [...state.data.customExercises.filter((e) => e.id !== x.id), x].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  set({ data: { ...state.data, customExercises: list } });
  return enqueue(() => getDb().put('exercises', x));
}

/**
 * Saves settings. When weekdays, football day, race date or plan start change, the standard week
 * in the calendar follows from today on (past entries stay as they were).
 */
export function saveSettings(patch: Partial<Settings>): Promise<void> {
  const before = state.data.settings;
  const settings = normalizeSettings({ ...before, ...patch, updatedAt: new Date().toISOString() });
  set({ data: { ...state.data, settings } });
  const scheduleChanged = JSON.stringify([before.days, before.football, before.raceDate, before.raceName, before.planStart])
    !== JSON.stringify([settings.days, settings.football, settings.raceDate, settings.raceName, settings.planStart]);
  const saved = enqueue(() => getDb().put('kv', settings, 'settings'));
  if (!scheduleChanged) return saved;
  const changes = syncStandardWeek(state.data.plans, state.data.templates, settings, today());
  return Promise.all([saved, savePlans(changes.save, changes.remove)]).then(() => undefined);
}

/** Resolves once all pending writes are stored (used before showing "saved" states and in tests). */
export function flushWrites(): Promise<unknown> {
  return writes;
}

export function getState(): AppState {
  return state;
}

export function activeSession(s: AppState = state): WorkoutSession | null {
  return s.data.sessions.find((x) => x.status === 'active') ?? null;
}

export function startRest(seconds: number) {
  set({ rest: seconds > 0 ? { endsAt: Date.now() + seconds * 1000, total: seconds } : null });
}

export function adjustRest(deltaSeconds: number) {
  const r = state.rest;
  if (!r) return;
  const endsAt = Math.max(Date.now(), r.endsAt + deltaSeconds * 1000);
  set({ rest: { endsAt, total: Math.max(1, r.total + deltaSeconds) } });
}

export function stopRest() {
  set({ rest: null });
}
