import { useState } from 'preact/hooks';
import { KIND_LABELS } from '../../domain/templates';
import type { SessionKind } from '../../domain/types';
import { useAppState } from '../../state/store';
import { BackLink, monthLabel, SessionRow } from '../components';

const KINDS: SessionKind[] = ['physio', 'strength', 'hyrox', 'football', 'free'];

export function History() {
  const { data } = useAppState();
  const [kind, setKind] = useState<SessionKind | null>(null);
  const list = data.sessions.filter((s) => s.status !== 'active' && (!kind || s.kind === kind));
  const months = [...new Set(list.map((s) => s.date.slice(0, 7)))];
  return (
    <main class="screen">
      <BackLink to={{ name: 'progress' }} label="Fortschritt" />
      <header class="page-head" style={{ marginTop: 'var(--space-3)' }}><div><p class="eyebrow">{list.length} Einträge</p><h1 class="title">Verlauf</h1></div></header>
      <div class="chips" role="group" aria-label="Art">
        <button class="chip-btn" aria-pressed={kind === null} onClick={() => setKind(null)}>Alle</button>
        {KINDS.map((k) => <button key={k} class="chip-btn" aria-pressed={kind === k} onClick={() => setKind(kind === k ? null : k)}>{KIND_LABELS[k]}</button>)}
      </div>
      {months.length ? months.map((m) => (
        <section key={m} class="section" style={{ marginTop: 'var(--space-4)' }}>
          <h2 class="eyebrow">{monthLabel(`${m}-01`)}</h2>
          <div class="list">{list.filter((s) => s.date.startsWith(m)).map((s) => <SessionRow key={s.id} session={s} />)}</div>
        </section>
      )) : <div class="empty" style={{ marginTop: 'var(--space-4)' }}><p class="muted small">Noch keine Einträge.</p></div>}
    </main>
  );
}
