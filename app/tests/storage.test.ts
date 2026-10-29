import { describe, expect, it } from 'vitest';
import { BackupError, createBackup, importBackup, parseBackup, sessionsToCsv } from '../src/backup/backup';
import { clearUserData, getKv, listSnapshots, openHyroxDb, readUserData, saveSnapshot } from '../src/db/db';
import { LEGACY_KEY } from '../src/legacy/convert';
import { runLegacyMigration } from '../src/legacy/migrate';
import { doneSession, LEGACY_STATE, NOW } from './fixtures';

let n = 0;
const freshDb = () => openHyroxDb(`test-${++n}`);
const storage = (value: string | null) => ({ getItem: (k: string) => (k === LEGACY_KEY ? value : null) });

describe('migration from the previous app', () => {
  it('imports once, keeps the raw value as snapshot and is idempotent', async () => {
    const db = await freshDb();
    const raw = JSON.stringify(LEGACY_STATE);
    const first = await runLegacyMigration(db, storage(raw), NOW);
    expect(first.status).toBe('imported');
    const data = await readUserData(db);
    expect(data.sessions.filter((s) => s.status === 'completed')).toHaveLength(1);
    expect(data.knee).toHaveLength(1);
    expect(data.settings.football).toBe('sunday');
    const snaps = await listSnapshots(db);
    expect(snaps[0]!.kind).toBe('legacy-storage');
    expect(JSON.parse(snaps[0]!.payload)[LEGACY_KEY]).toBe(raw);
    expect((await runLegacyMigration(db, storage(raw), NOW)).status).toBe('unchanged');
  });

  it('does nothing without old data and survives broken JSON', async () => {
    const db = await freshDb();
    expect((await runLegacyMigration(db, storage(null), NOW)).status).toBe('none');
    const broken = await runLegacyMigration(db, storage('{kaputt'), NOW);
    expect(broken.status).toBe('imported');
    expect((await readUserData(db)).sessions).toHaveLength(0);
  });

  it('never overwrites a record that was changed in the new app', async () => {
    const db = await freshDb();
    await runLegacyMigration(db, storage(JSON.stringify(LEGACY_STATE)), NOW);
    const s = (await readUserData(db)).sessions.find((x) => x.id === 'legacy-ses-a1')!;
    await db.put('sessions', { ...s, note: 'geändert', rev: 1 });
    const changed = { ...LEGACY_STATE, sessions: LEGACY_STATE.sessions.map((x) => (x.id === 'a1' ? { ...x, note: 'alt neu' } : x)) };
    const r = await runLegacyMigration(db, storage(JSON.stringify(changed)), NOW);
    expect(r.status === 'imported' && r.state.outcome.keptLocal).toBeGreaterThan(0);
    expect((await readUserData(db)).sessions.find((x) => x.id === 'legacy-ses-a1')!.note).toBe('geändert');
  });
});

describe('backup', () => {
  it('round-trips through JSON and snapshots the state before importing', async () => {
    const db = await freshDb();
    await db.put('sessions', doneSession({ date: '2026-11-03', exerciseId: 'hyrox-skierg', sets: [{ value: 250, timeSec: 62 }], kind: 'hyrox', kneeBefore: 1, kneeAfter: 2 }));
    const text = JSON.stringify(await createBackup(db, NOW));
    const target = await freshDb();
    const parsed = parseBackup(text, 'backup.json', NOW);
    expect(parsed.kind).toBe('hyrox');
    const outcome = await importBackup(target, parsed, 'merge', 'backup.json', NOW);
    expect(outcome.added).toBe(1);
    const back = await readUserData(target);
    expect(back.sessions[0]!.exercises[0]!.sets[0]!.timeSec).toBe(62);
    expect((await listSnapshots(target))[0]!.reason).toContain('backup.json');
  });

  it('rejects junk and skips broken entries instead of crashing the app later', () => {
    expect(() => parseBackup('{kaputt', 'x.json')).toThrow(BackupError);
    expect(() => parseBackup('{"a":1}', 'x.json')).toThrow(BackupError);
    const semi = JSON.stringify({ format: 'hyrox-trainer-backup', schemaVersion: 1, data: { sessions: [{ status: 'completed' }, null], plans: 'x', knee: [{ pain: 22 }] } });
    const parsed = parseBackup(semi, 'semi.json');
    expect(parsed.sessions).toHaveLength(0);
    expect(parsed.knee).toHaveLength(0);
    expect(parsed.kind === 'hyrox' && parsed.skipped.length).toBe(3);
    expect(() => parseBackup(JSON.stringify({ format: 'hyrox-trainer-backup', schemaVersion: 99, data: { sessions: [] } }), 'new.json')).toThrow(/neueren/);
  });

  it('accepts JSON backups of the previous app', () => {
    const parsed = parseBackup(JSON.stringify(LEGACY_STATE), 'HYROX-Trainer-backup.json', NOW);
    expect(parsed.kind).toBe('legacy');
    expect(parsed.sessions.map((s) => s.id)).toContain('legacy-ses-a1');
  });

  it('exports one CSV row per set with knee values', () => {
    const csv = sessionsToCsv([doneSession({ date: '2026-11-03', exerciseId: 'strength-bench-press', sets: [{ value: 6, weightKg: 80 }, { value: 5, weightKg: 80 }], kneeAfter: 1 })]);
    const rows = csv.replace('﻿', '').split('\r\n');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toContain('Bankdrücken');
    expect(rows[1]).toContain(';80;');
  });

  it('deleting all data keeps the import record and the snapshots', async () => {
    const db = await freshDb();
    await runLegacyMigration(db, storage(JSON.stringify(LEGACY_STATE)), NOW);
    await saveSnapshot(db, { id: 'snap_x', takenAt: NOW.toISOString(), kind: 'user-data', reason: 'Test', payload: '{}' });
    await clearUserData(db);
    expect((await readUserData(db)).sessions).toHaveLength(0);
    expect(await getKv(db, 'legacyImport')).toBeTruthy();
    expect((await listSnapshots(db)).length).toBeGreaterThan(0);
    expect((await runLegacyMigration(db, storage(JSON.stringify(LEGACY_STATE)), NOW)).status).toBe('unchanged');
  });
});
