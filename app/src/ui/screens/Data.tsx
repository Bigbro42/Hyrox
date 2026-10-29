import { useState } from 'preact/hooks';
import { BackupError, createBackup, importBackup, kneeToCsv, parseBackup, sessionsToCsv, type ParsedBackup } from '../../backup/backup';
import { clearUserData, saveSnapshot, type Snapshot } from '../../db/db';
import { today } from '../../domain/dates';
import { count } from '../../domain/format';
import { newId } from '../../domain/ids';
import { kneePoints } from '../../domain/knee';
import { getDb, refresh, requestPersist, reseed, useAppState } from '../../state/store';
import { BackLink, Notice, Sheet } from '../components';
import { Icon } from '../icons';

function download(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function dateTime(iso: string) {
  return new Date(iso).toLocaleString('de-AT', { dateStyle: 'medium', timeStyle: 'short' });
}

type Pending = { parsed: ParsedBackup; fileName: string };

export function Data() {
  const { data, legacy, snapshots, persist } = useAppState();
  const [pending, setPending] = useState<Pending | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const exportJson = async () => {
    const backup = await createBackup(getDb());
    download(`HYROX-Trainer_Backup_${today()}.json`, 'application/json', JSON.stringify(backup, null, 2));
  };

  const onFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setMessage(null);
    try {
      setPending({ parsed: parseBackup(await file.text(), file.name), fileName: file.name });
      setMode('merge');
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof BackupError ? err.message : `Die Datei konnte nicht gelesen werden: ${(err as Error).message}` });
    }
  };

  const confirmImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const outcome = await importBackup(getDb(), pending.parsed, mode, pending.fileName);
      await refresh();
      const kept = outcome.keptLocal ? ` ${outcome.keptLocal} vorhandene Einträge waren aktueller und wurden behalten.` : '';
      setMessage({ tone: 'info', text: `Import abgeschlossen: ${outcome.added} neu, ${outcome.updated} aktualisiert.${kept} Der vorherige Stand ist als Sicherung gespeichert.` });
      setPending(null);
    } catch (err) {
      setMessage({ tone: 'error', text: `Import fehlgeschlagen, es wurde nichts verändert: ${(err as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  const wipe = async () => {
    setBusy(true);
    try {
      const db = getDb();
      await saveSnapshot(db, { id: newId('snap'), takenAt: new Date().toISOString(), kind: 'user-data', reason: 'Vor dem Löschen aller Daten', payload: JSON.stringify(await createBackup(db)) });
      await clearUserData(db);
      await reseed();
      setMessage({ tone: 'info', text: 'Alle Trainingsdaten wurden gelöscht. Eine Sicherung des vorherigen Stands liegt unten unter „Automatische Sicherungen“.' });
    } catch (err) {
      setMessage({ tone: 'error', text: `Löschen fehlgeschlagen: ${(err as Error).message}` });
    } finally {
      setBusy(false);
      setWiping(false);
      setConfirmText('');
    }
  };

  const downloadSnapshot = (s: Snapshot) => {
    download(`HYROX-Trainer_${s.kind === 'legacy-storage' ? 'Rohdaten_alte_Version' : 'Sicherung'}_${s.takenAt.slice(0, 10)}.json`, 'application/json', s.payload);
  };

  const p = pending?.parsed;
  const completed = data.sessions.filter((s) => s.status === 'completed').length;

  return (
    <main class="screen">
      <BackLink to={{ name: 'home' }} label="Heute" />
      <header class="page-head" style={{ marginTop: 'var(--space-3)' }}>
        <div><p class="eyebrow">Alles lokal auf diesem Gerät</p><h1 class="title">Daten & Backup</h1></div>
      </header>

      <div class="stack">
        {message && <Notice tone={message.tone}><p>{message.text}</p></Notice>}
        <Notice tone="info" icon="shield" title="Keine Cloud, kein Konto">
          <p>Trainings- und Kniewerte werden nur in diesem Browser gespeichert und nirgends hochgeladen. Beim Löschen der Browserdaten oder bei einem Gerätewechsel sind sie ohne Backup weg.</p>
        </Notice>
      </div>

      <section class="section" aria-labelledby="backup">
        <h2 class="h2" id="backup">Sichern</h2>
        <div class="stats" style={{ marginTop: 'var(--space-3)' }}>
          <div class="stat"><b>{completed}</b><span>Einheiten</span></div>
          <div class="stat"><b>{kneePoints(data.sessions, data.knee).length}</b><span>Kniewerte</span></div>
          <div class="stat"><b>{data.templates.length}</b><span>Vorlagen</span></div>
        </div>
        <div class="stack" style={{ marginTop: 'var(--space-3)' }}>
          <button class="btn btn-primary btn-block" onClick={() => void exportJson()}><Icon name="download" size={18} />JSON-Backup herunterladen</button>
          <button class="btn btn-secondary btn-block" onClick={() => download(`HYROX-Trainer_Training_${today()}.csv`, 'text/csv;charset=utf-8', sessionsToCsv(data.sessions))}><Icon name="download" size={18} />Trainings als CSV (Excel)</button>
          <button class="btn btn-secondary btn-block" onClick={() => download(`HYROX-Trainer_Knie_${today()}.csv`, 'text/csv;charset=utf-8', kneeToCsv(kneePoints(data.sessions, data.knee)))}><Icon name="download" size={18} />Kniewerte als CSV</button>
        </div>
        <p class="muted small">Tipp: Das JSON-Backup regelmäßig in iCloud Drive oder Google Drive ablegen – es enthält alles, auch die Rohdaten der bisherigen Version.</p>
      </section>

      <section class="section" aria-labelledby="restore">
        <h2 class="h2" id="restore">Wiederherstellen</h2>
        <label class="btn btn-secondary btn-block file-btn" style={{ marginTop: 'var(--space-3)' }}>
          <Icon name="upload" size={18} />Backup-Datei auswählen
          <input type="file" accept=".json,application/json" onChange={(e) => void onFile(e)} aria-label="Backup-Datei auswählen" />
        </label>
        <p class="muted small">Akzeptiert Backups dieser App und JSON-Backups der bisherigen Version. Vor jedem Import wird der aktuelle Stand automatisch gesichert.</p>
      </section>

      <section class="section" aria-labelledby="device">
        <h2 class="h2" id="device">Speicher</h2>
        <div class="card" style={{ marginTop: 'var(--space-3)' }}>
          <p style={{ margin: 0 }}>{persist === 'persisted' ? 'Der Browser schützt die Daten vor automatischem Löschen.' : persist === 'not-persisted' ? 'Der Browser kann die Daten bei Speichermangel löschen.' : 'Dieser Browser meldet keinen Speicherschutz.'}</p>
          {persist === 'not-persisted' && <button class="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-2)' }} onClick={() => void requestPersist()}>Dauerhaften Speicher anfragen</button>}
          {legacy && (
            <p class="muted small" style={{ margin: 'var(--space-3) 0 0' }}>
              Übernahme aus der bisherigen Version am {dateTime(legacy.importedAt)}: {count(legacy.report.completedSessions, 'Training', 'Trainings')}, {count(legacy.report.kneeLogs, 'Knie-Check', 'Knie-Checks')}. Die alten Daten liegen unverändert im Browser.
              {legacy.report.problems.length > 0 && ` Hinweise: ${legacy.report.problems.join('; ')}.`}
            </p>
          )}
        </div>
      </section>

      <section class="section" aria-labelledby="snapshots">
        <h2 class="h2" id="snapshots">Automatische Sicherungen</h2>
        {snapshots.length ? (
          <ul class="history-list">
            {snapshots.map((s) => (
              <li key={s.id}><a href="#" onClick={(e) => { e.preventDefault(); downloadSnapshot(s); }}><span>{dateTime(s.takenAt)}</span><span>{s.reason} <Icon name="download" size={14} /></span></a></li>
            ))}
          </ul>
        ) : <p class="muted small">Noch keine. Sie entstehen vor jedem Import und vor dem Löschen.</p>}
      </section>

      <section class="section" aria-labelledby="wipe">
        <h2 class="h2" id="wipe">Alles löschen</h2>
        <button class="btn btn-danger btn-block" style={{ marginTop: 'var(--space-3)' }} onClick={() => setWiping(true)}><Icon name="trash" size={18} />Alle Trainingsdaten löschen</button>
      </section>

      {pending && p && (
        <Sheet title="Backup importieren" onClose={() => setPending(null)}>
          <p><b>{pending.fileName}</b>{p.kind === 'legacy' ? ' (bisherige Version)' : ''}: {count(p.sessions.length, 'Training', 'Trainings')}, {count(p.knee.length, 'Kniewert', 'Kniewerte')}, {count(p.templates.length, 'Vorlage', 'Vorlagen')}.</p>
          {p.kind === 'hyrox' && p.skipped.length > 0 && <Notice tone="warn"><p>{p.skipped.length} beschädigte Einträge werden übersprungen ({p.skipped.slice(0, 5).join(', ')}{p.skipped.length > 5 ? ' …' : ''}).</p></Notice>}
          <label class="choice">
            <input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
            <span><b>Zusammenführen</b><small>Neue Einträge kommen dazu. Bei gleichen Einträgen gewinnt die neuere Fassung.</small></span>
          </label>
          <label class="choice">
            <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
            <span><b>Ersetzen</b><small>Der aktuelle Stand wird durch das Backup ersetzt (vorher automatisch gesichert).</small></span>
          </label>
          <div class="stack" style={{ marginTop: 'var(--space-4)' }}>
            <button class="btn btn-primary btn-block" disabled={busy} onClick={() => void confirmImport()}>{busy ? 'Importiere …' : 'Importieren'}</button>
            <button class="btn btn-secondary btn-block" onClick={() => setPending(null)}>Abbrechen</button>
          </div>
        </Sheet>
      )}
      {wiping && (
        <Sheet title="Alle Trainingsdaten löschen?" onClose={() => setWiping(false)}>
          <p>Trainings, Kniewerte, eigene Übungen, Vorlagen-Änderungen und Einstellungen werden gelöscht. Vorher wird automatisch eine Sicherung angelegt. Lade zur Sicherheit zusätzlich ein Backup herunter.</p>
          <label class="field">
            <span>Zum Bestätigen LÖSCHEN eintippen</span>
            <input class="input" value={confirmText} onInput={(e) => setConfirmText((e.currentTarget as HTMLInputElement).value)} autoComplete="off" />
          </label>
          <div class="stack" style={{ marginTop: 'var(--space-4)' }}>
            <button class="btn btn-danger btn-block" disabled={busy || confirmText.trim().toUpperCase() !== 'LÖSCHEN'} onClick={() => void wipe()}>Endgültig löschen</button>
            <button class="btn btn-secondary btn-block" onClick={() => setWiping(false)}>Abbrechen</button>
          </div>
        </Sheet>
      )}
    </main>
  );
}
