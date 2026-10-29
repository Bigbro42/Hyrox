import { useState } from 'preact/hooks';
import { formatDate } from '../../domain/dates';
import { kneePoints, lightOf, SOURCE_LABELS } from '../../domain/knee';
import { kneeOf } from '../../state/knee';
import { deleteKneeLog, useAppState } from '../../state/store';
import { LineChart, type Datum } from '../charts';
import { BackLink, LightDot, Notice, Sheet } from '../components';
import { Icon } from '../icons';
import { href } from '../router';
import { KneeSheet } from '../sheets';

export function Knee() {
  const state = useAppState();
  const { data } = state;
  const { settings } = data;
  const knee = kneeOf(state);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const points = kneePoints(data.sessions, data.knee);
  const chart: Datum[] = points.slice(-40).map((p, i) => ({ key: `${p.at}-${i}`, label: formatDate(p.date, { day: 'numeric', month: 'numeric' }), value: p.pain, detail: `${formatDate(p.date, { day: 'numeric', month: 'short' })} · ${SOURCE_LABELS[p.source]}: ${p.pain}/10` }));
  const logIdAt = (at: string) => data.knee.find((k) => k.at === at)?.id;

  return (
    <main class="screen">
      <BackLink to={{ name: 'physio' }} label="Physio" />
      <header class="page-head" style={{ marginTop: 'var(--space-3)' }}>
        <div><p class="eyebrow">Schmerz-Monitoring</p><h1 class="title">Knie</h1></div>
        <button class="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Icon name="plus" size={16} />Knie-Check</button>
      </header>

      <section class="card">
        <div class="knee-head"><LightDot light={knee.light} />{knee.trend && <span class="muted small">Tendenz: {knee.trend === 'up' ? 'steigend' : knee.trend === 'down' ? 'sinkend' : 'gleichbleibend'}</span>}</div>
        <p class="small" style={{ margin: 'var(--space-2) 0 0' }}>{knee.reason}</p>
        <p class="small" style={{ margin: 'var(--space-1) 0 0' }}>{knee.advice}</p>
      </section>

      {knee.seeProfessional && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Notice tone="warn" title="Abklärung empfohlen"><p>Bei anhaltenden oder zunehmenden Beschwerden an der Knievorderseite bitte sportmedizinisch oder physiotherapeutisch abklären lassen. Die App stellt keine Diagnose.</p></Notice>
        </div>
      )}

      <section class="section" aria-labelledby="chart">
        <div class="section-head"><h2 class="h2" id="chart">Verlauf</h2></div>
        <div class="card"><LineChart data={chart} title="Knieschmerz" valueLabel="Schmerz (0–10)" summary={points.length ? `${points.length} Einträge` : ''} unit="Schmerz 0–10" /></div>
      </section>

      <section class="section" aria-labelledby="rules">
        <div class="section-head"><h2 class="h2" id="rules">So entsteht die Ampel</h2><a class="btn btn-ghost" href={href({ name: 'settings' })}>Grenzen</a></div>
        <div class="card">
          <ul class="plain-list">
            <li><LightDot light="green" label={false} /> 0–{settings.kneeGreenMax}: Belastung wie geplant</li>
            <li><LightDot light="yellow" label={false} /> {settings.kneeGreenMax + 1}–{settings.kneeYellowMax}: halten, nicht steigern</li>
            <li><LightDot light="red" label={false} /> ab {settings.kneeYellowMax + 1}: schonen, Übungen ersetzen</li>
            <li>Steigt der Wert während eines Trainings um 2 oder mehr, ist die Ampel mindestens gelb.</li>
            <li>Steigen die letzten drei Werte im Schnitt um 1 oder mehr, ebenfalls.</li>
          </ul>
          <p class="muted small" style={{ margin: 'var(--space-3) 0 0' }}>Ein verbreiteter Ansatz aus der Physiotherapie (Schmerz-Monitoring). Die Grenzen sind ein Vorschlag – stimme sie mit deinem Physio ab.</p>
        </div>
      </section>

      <section class="section" aria-labelledby="list">
        <div class="section-head"><h2 class="h2" id="list">Alle Einträge</h2></div>
        {points.length ? (
          <ul class="history-list">
            {[...points].reverse().map((p, i) => {
              const id = p.source === 'check' || p.source === 'morning' || (p.source === 'football' && !p.sessionId) ? logIdAt(p.at) : undefined;
              return (
                <li key={`${p.at}-${i}`} class="knee-row">
                  <span>{formatDate(p.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {SOURCE_LABELS[p.source]}</span>
                  <span class="knee-row-value"><LightDot light={lightOf(p.pain, settings)} label={false} /><b class="tabular">{p.pain}/10</b>
                    {id && <button class="icon-btn icon-btn-sm" aria-label="Eintrag löschen" onClick={() => setRemoving(id)}><Icon name="trash" size={14} /></button>}
                    {p.sessionId && <a class="icon-btn icon-btn-sm" aria-label="Zum Training" href={href({ name: 'session', id: p.sessionId })}><Icon name="chevron" size={14} /></a>}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : <div class="empty"><p class="muted small">Noch keine Kniewerte. Trage vor und nach dem Training ein, wie es deinem Knie geht.</p></div>}
      </section>

      {open && <KneeSheet onClose={() => setOpen(false)} />}
      {removing && (
        <Sheet title="Eintrag löschen?" onClose={() => setRemoving(null)}>
          <p>Der Knie-Check wird dauerhaft entfernt.</p>
          <div class="stack">
            <button class="btn btn-danger btn-block" onClick={() => { void deleteKneeLog(removing); setRemoving(null); }}>Löschen</button>
            <button class="btn btn-secondary btn-block" onClick={() => setRemoving(null)}>Behalten</button>
          </div>
        </Sheet>
      )}
    </main>
  );
}
