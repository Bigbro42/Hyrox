import { getKv, mergeUserData, saveSnapshot, setKv, type Db, type LegacyImportState } from '../db/db';
import { newId } from '../domain/ids';
import { convertLegacy, LEGACY_KEY, parseLegacyStorage } from './convert';

/** FNV-1a over the raw value; only used to notice that the previous app's data changed. */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0') + ':' + text.length;
}

export type MigrationResult =
  | { status: 'none' }
  | { status: 'unchanged'; state: LegacyImportState }
  | { status: 'imported'; state: LegacyImportState; firstImport: boolean };

/**
 * Takes over the previous app's data when it is new or changed since the last import. Order: raw
 * snapshot first, then one atomic merge. localStorage is only read, never written or removed.
 * Records already changed in this app are kept.
 */
export async function runLegacyMigration(db: Db, storage: Pick<Storage, 'getItem'>, now = new Date()): Promise<MigrationResult> {
  const raw = storage.getItem(LEGACY_KEY);
  if (raw === null) return { status: 'none' };
  const hash = hashText(raw);
  const previous = await getKv(db, 'legacyImport');
  if (previous?.hash === hash) return { status: 'unchanged', state: previous };

  await saveSnapshot(db, {
    id: newId('snap'),
    takenAt: now.toISOString(),
    kind: 'legacy-storage',
    reason: previous ? 'Änderungen aus der bisherigen App' : 'Erste Übernahme aus der bisherigen App',
    payload: JSON.stringify({ [LEGACY_KEY]: raw }),
  });
  const problems: string[] = [];
  const data = parseLegacyStorage(raw, problems);
  const result = data ? convertLegacy(data, { now }) : null;
  const report = result?.report ?? { origin: LEGACY_KEY, completedSessions: 0, draftSessions: 0, skippedEmpty: 0, kneeLogs: 0, templates: 0, customExercises: 0, problems: [] };
  report.problems.unshift(...problems);
  const state: LegacyImportState = { hash, importedAt: now.toISOString(), report, outcome: { added: 0, updated: 0, keptLocal: 0 } };
  if (result) state.outcome = await mergeUserData(db, result, 'refresh');
  // Written last: if the app is closed in between, the (idempotent) import simply runs again.
  await setKv(db, 'legacyImport', state);
  return { status: 'imported', state, firstImport: !previous };
}
