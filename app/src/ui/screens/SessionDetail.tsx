import { useState } from 'preact/hooks';
import { METRIC_LABELS } from '../../domain/catalog';
import { formatDate } from '../../domain/dates';
import { clock, fmtNum } from '../../domain/format';
import { lightOf } from '../../domain/knee';
import { KIND_LABELS } from '../../domain/templates';
import { activeSession, deleteSession, useAppState } from '../../state/store';
import { reopenSession } from '../../state/workout';
import { BackLink, LightDot, Notice, Sheet, StatusChip } from '../components';
import { Icon } from '../icons';
import { navigate } from '../router';

export function SessionDetail({ id }: { id: string }) {
  const state = useAppState();
  const { data } = state;
  const [removing, setRemoving] = useState(false);
  const session = data.sessions.find((s) => s.id === id);
  if (!session) {
    return (
      <main class="screen">
        <BackLink to={{ name: 'history' }} label="Verlauf" />
        <div class="empty" style={{ marginTop: 'var(--space-4)' }}><h1 class="h3">Eintrag nicht gefunden</h1></div>
      </main>
    );
  }
  const running = activeSession(state);
  return (
    <main class="screen">
      <BackLink to={{ name: 'history' }} label="Verlauf" />
      <header style={{ margin: 'var(--space-3) 0' }}>
        <p class="eyebrow">{formatDate(session.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <h1 class="title title-m">{session.title}</h1>
        <div class="facts"><StatusChip status={session.status} /><span class="chip chip-neutral">{KIND_LABELS[session.kind]}</span></div>
      </header>

      <div class="card">
        <dl class="kv">
          <dt>Dauer</dt><dd>{session.durationMin ? `${session.durationMin} Min.` : '–'}</dd>
          <dt>Belastung (RPE)</dt><dd>{session.rpe ?? '–'}</dd>
          <dt>Knie vorher</dt><dd>{session.kneeBefore !== null ? <><LightDot light={lightOf(session.kneeBefore, data.settings)} label={false} /> {session.kneeBefore}/10</> : '–'}</dd>
          <dt>Knie nachher</dt><dd>{session.kneeAfter !== null ? <><LightDot light={lightOf(session.kneeAfter, data.settings)} label={false} /> {session.kneeAfter}/10</> : '–'}</dd>
        </dl>
        {session.note && <p class="small" style={{ margin: 'var(--space-3) 0 0', whiteSpace: 'pre-line' }}>{session.note}</p>}
      </div>
      {session.legacy?.inferred?.length ? <div style={{ marginTop: 'var(--space-3)' }}><Notice tone="info"><p>Aus der bisherigen App übernommen. Ergänzt wurde: {session.legacy.inferred.map((f) => (f === 'completedAt' ? 'Abschlusszeit' : f === 'kneeAfter' ? 'Zeitpunkt des Kniewerts' : f)).join(', ')}.</p></Notice></div> : null}

      {session.exercises.map((x) => (
        <section key={x.id} class="card exercise" style={{ marginTop: 'var(--space-3)' }}>
          <div class="exercise-head"><h2 class="h3">{x.name}</h2><span class="muted small">{METRIC_LABELS[x.metric].long}</span></div>
          <table class="sets">
            <thead><tr><th>Satz</th><th>kg</th><th>{METRIC_LABELS[x.metric].short}</th>{x.timed && <th>Zeit</th>}<th>✓</th></tr></thead>
            <tbody>
              {x.sets.map((s, i) => (
                <tr key={s.id}><td>{i + 1}</td><td>{s.weightKg !== null ? fmtNum(s.weightKg) : '–'}</td><td>{s.value !== null ? fmtNum(s.value) : '–'}</td>{x.timed && <td>{s.timeSec !== null ? clock(s.timeSec) : '–'}</td>}<td>{s.done ? 'Ja' : ''}</td></tr>
              ))}
            </tbody>
          </table>
          {x.note && <p class="muted small" style={{ margin: 'var(--space-2) 0 0' }}>{x.note}</p>}
        </section>
      ))}

      <div class="stack" style={{ marginTop: 'var(--space-5)' }}>
        {session.kind !== 'football' && session.status !== 'active' && (
          <button class="btn btn-secondary btn-block" disabled={Boolean(running)} onClick={() => reopenSession(session)}>
            <Icon name={session.status === 'draft' ? 'play' : 'edit'} size={18} />{session.status === 'draft' ? 'Fortsetzen' : 'Korrigieren'}
          </button>
        )}
        {running && session.status !== 'active' && <p class="muted small" style={{ margin: 0 }}>Es läuft gerade ein anderes Training.</p>}
        <button class="btn btn-ghost btn-block" onClick={() => setRemoving(true)}><Icon name="trash" size={18} />Eintrag löschen</button>
      </div>

      {removing && (
        <Sheet title="Eintrag löschen?" onClose={() => setRemoving(false)}>
          <p>{session.title} vom {formatDate(session.date)} wird mit allen Sätzen und Kniewerten dauerhaft gelöscht. Ein Backup unter „Daten & Backup“ enthält ihn weiterhin.</p>
          <div class="stack">
            <button class="btn btn-danger btn-block" onClick={() => { void deleteSession(session.id); navigate({ name: 'history' }, true); }}>Löschen</button>
            <button class="btn btn-secondary btn-block" onClick={() => setRemoving(false)}>Behalten</button>
          </div>
        </Sheet>
      )}
    </main>
  );
}
