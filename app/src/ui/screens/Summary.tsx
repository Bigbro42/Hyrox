import { formatDate } from '../../domain/dates';
import { count } from '../../domain/format';
import { levelOf, xp, XP_PER_KIND } from '../../domain/gamification';
import { recordsIn } from '../../domain/history';
import { lightOf } from '../../domain/knee';
import { upcoming } from '../../domain/calendar';
import { today } from '../../domain/dates';
import { useAppState } from '../../state/store';
import { LightDot, Notice } from '../components';
import { Icon } from '../icons';
import { href } from '../router';

export function Summary({ id }: { id: string }) {
  const { data } = useAppState();
  const session = data.sessions.find((s) => s.id === id);
  if (!session || session.status !== 'completed') {
    return (
      <main class="screen">
        <div class="empty"><h1 class="h3">Training nicht gefunden</h1><a class="btn btn-primary" href={href({ name: 'home' })} style={{ marginTop: 'var(--space-3)' }}>Zu Heute</a></div>
      </main>
    );
  }
  const sets = session.exercises.reduce((n, x) => n + x.sets.filter((s) => s.value !== null || s.timeSec !== null).length, 0);
  const records = recordsIn(session, data.sessions);
  const total = xp(data.sessions, data.knee).total;
  const lvl = levelOf(total);
  const before = levelOf(total - XP_PER_KIND[session.kind]);
  const after = session.kneeAfter;
  const rise = after !== null && session.kneeBefore !== null ? after - session.kneeBefore : 0;
  const next = upcoming(data.plans, data.sessions, today(), 1)[0];

  return (
    <main class="screen">
      <section class="done-hero">
        <div class="done-badge" aria-hidden="true"><Icon name="check" size={36} /></div>
        <p class="eyebrow">{formatDate(session.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 class="title">Stark gemacht!</h1>
        <p class="muted">{session.title} ist abgeschlossen und gespeichert.</p>
        <p class="xp-gain">+{XP_PER_KIND[session.kind]} XP{lvl.level > before.level ? ` · Level ${lvl.level} erreicht: ${lvl.name}` : ''}</p>
      </section>

      <div class="stats" style={{ marginTop: 'var(--space-5)' }}>
        <div class="stat"><b>{session.durationMin ?? '–'}</b><span>Minuten</span></div>
        <div class="stat"><b>{sets}</b><span>Sätze erfasst</span></div>
        <div class="stat"><b>{session.rpe ?? '–'}</b><span>Belastung (RPE)</span></div>
      </div>

      <section class="card" style={{ marginTop: 'var(--space-3)' }} aria-label="Knie">
        <p class="eyebrow">Knie</p>
        {after === null ? (
          <p class="muted small" style={{ margin: 0 }}>Kein Wert nach dem Training eingetragen. Du kannst den Knie-Check jederzeit unter „Heute“ nachholen.</p>
        ) : (
          <>
            <div class="knee-compare">
              <span>{session.kneeBefore !== null ? `${session.kneeBefore} → ${after}` : `${after}`}<small>/10</small></span>
              <LightDot light={lightOf(after, data.settings)} />
            </div>
            {rise >= 2 || lightOf(after, data.settings) === 'red' ? (
              <Notice tone="warn"><p>Das Knie hat deutlich reagiert. Plane die nächste Einheit kniefreundlich und beobachte den Wert morgen früh. Bei anhaltenden Beschwerden bitte abklären lassen.</p></Notice>
            ) : (
              <p class="muted small" style={{ margin: 0 }}>Gut gesteuert. Morgen früh kurz nachspüren: Ist es nicht schlechter, passt die Belastung.</p>
            )}
          </>
        )}
      </section>

      {records.length > 0 && (
        <section class="card" style={{ marginTop: 'var(--space-3)' }} aria-label="Neue Bestleistungen">
          <p class="eyebrow"><Icon name="trophy" size={14} /> Neue Bestleistung{records.length > 1 ? 'en' : ''}</p>
          <ul class="plain-list">{records.map((r) => <li key={r.exerciseId}><b>{r.name}</b>: {r.label}</li>)}</ul>
        </section>
      )}

      {next && <p class="muted small" style={{ marginTop: 'var(--space-4)' }}>Als Nächstes: {next.plan.title} am {formatDate(next.date, { weekday: 'long', day: 'numeric', month: 'long' })}.</p>}

      <div class="stack" style={{ marginTop: 'var(--space-5)' }}>
        <a class="btn btn-primary btn-block" href={href({ name: 'home' })}>Fertig</a>
        <a class="btn btn-secondary btn-block" href={href({ name: 'session', id: session.id })}>{count(session.exercises.length, 'Übung', 'Übungen')} ansehen</a>
      </div>
    </main>
  );
}
