import { useState } from 'preact/hooks';
import { addDays } from '../../domain/calendar';
import { KNEE_LOAD_LABELS, LIBRARY_EXERCISES, tierOf, TIER_LABELS, TIER_ORDER } from '../../domain/catalog';
import { formatDate, today } from '../../domain/dates';
import { count, fmtNum } from '../../domain/format';
import { kneePoints } from '../../domain/knee';
import { TEMPLATE_IDS } from '../../domain/templates';
import type { Tier } from '../../domain/types';
import { kneeOf } from '../../state/knee';
import { activeSession, useAppState } from '../../state/store';
import { startTemplate } from '../../state/workout';
import { LineChart, type Datum } from '../charts';
import { LightDot, Notice, TierChip } from '../components';
import { Icon } from '../icons';
import { href } from '../router';
import { KneeSheet } from '../sheets';

const PHYSIO = LIBRARY_EXERCISES.filter((x) => x.category === 'physio');

export function Physio() {
  const state = useAppState();
  const { data } = state;
  const [filter, setFilter] = useState<Tier | null>(null);
  const [kneeOpen, setKneeOpen] = useState(false);
  const knee = kneeOf(state);
  const now = today();
  const template = data.templates.find((t) => t.id === TEMPLATE_IDS.A);
  const points = kneePoints(data.sessions, data.knee).slice(-20);
  const chart: Datum[] = points.map((p, i) => ({ key: `${p.at}-${i}`, label: formatDate(p.date, { day: 'numeric', month: 'numeric' }), value: p.pain, detail: `${formatDate(p.date, { day: 'numeric', month: 'short' })}: ${p.pain}/10` }));
  const physioSessions = data.sessions.filter((s) => s.status === 'completed' && s.kind === 'physio');
  const avgAfter = (from: string, to: string) => {
    const xs = physioSessions.filter((s) => s.date >= from && s.date <= to && s.kneeAfter !== null).map((s) => s.kneeAfter!);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const recent = avgAfter(addDays(now, -27), now);
  const earlier = avgAfter(addDays(now, -55), addDays(now, -28));
  const list = PHYSIO.filter((x) => !filter || tierOf(x, data.settings) === filter);

  return (
    <main class="screen">
      <header class="page-head">
        <div><p class="eyebrow">Rehab & Prehab</p><h1 class="title">Physio</h1><p class="muted small">Knie-Stabilität und Belastungsverträglichkeit</p></div>
      </header>

      {template && (
        <section class="card-hero" aria-labelledby="unit">
          <div class="hero-top"><p class="eyebrow">Einheit A · 1× pro Woche</p><LightDot light={knee.light} /></div>
          <h2 class="h2 hero-title" id="unit">{template.name}</h2>
          <p class="muted">{count(template.exercises.length, 'Übung', 'Übungen')} · ca. {template.minutes} Min. · gelenkschonend</p>
          <button class="btn btn-primary btn-block btn-lg" style={{ marginTop: 'var(--space-4)' }} onClick={() => startTemplate(template)}>
            <Icon name="play" size={18} />{activeSession(state) ? 'Zum laufenden Training' : 'Physio starten'}
          </button>
          <a class="btn btn-ghost btn-block" href={href({ name: 'template', id: template.id })}>Übungen anpassen</a>
        </section>
      )}

      <div style={{ marginTop: 'var(--space-3)' }}>
        <Notice tone={data.settings.kneeAssessed ? 'info' : 'warn'} title={data.settings.kneeAssessed ? 'Nach Abklärung anpassen' : 'Abklärung empfohlen'}>
          <p>{data.settings.kneeAssessed
            ? 'Stimme Übungsauswahl, Freigaben und Schmerzgrenzen mit deinem Physio ab und passe sie hier an.'
            : 'Solange Kniebeschwerden nicht abgeklärt sind, bleibt die Auswahl vorsichtig. Die App stellt keine Diagnose und gibt Sprung- und Laufbelastungen nicht automatisch frei.'}</p>
        </Notice>
      </div>

      <section class="section" aria-labelledby="knee">
        <div class="section-head">
          <h2 class="h2" id="knee">Knie-Verlauf</h2>
          <button class="btn btn-secondary btn-sm" onClick={() => setKneeOpen(true)}><Icon name="pulse" size={16} />Knie-Check</button>
        </div>
        <div class="card">
          <div class="knee-head"><LightDot light={knee.light} /><a class="btn btn-ghost btn-sm" href={href({ name: 'knee' })}>Details<Icon name="chevron" size={16} /></a></div>
          <p class="muted small" style={{ margin: 'var(--space-2) 0 var(--space-3)' }}>{knee.reason}</p>
          <LineChart data={chart} title="Knieschmerz der letzten Einträge" valueLabel="Schmerz (0–10)" summary={points.length ? `Letzter Wert: ${points.at(-1)!.pain}/10` : ''} unit="Schmerz 0–10" />
        </div>
        <div class="stats" style={{ marginTop: 'var(--space-2)' }}>
          <div class="stat"><b>{physioSessions.length}</b><span>Physio-Einheiten</span></div>
          <div class="stat"><b>{recent !== null ? fmtNum(Math.round(recent * 10) / 10) : '–'}</b><span>Ø Knie danach · 4 Wochen</span></div>
          <div class="stat"><b>{recent !== null && earlier !== null ? (recent < earlier ? '↓' : recent > earlier ? '↑' : '→') : '–'}</b><span>{recent !== null && earlier !== null ? (recent < earlier ? 'Besser vertragen' : recent > earlier ? 'Mehr Beschwerden' : 'Unverändert') : 'Vergleich ab 2 Monaten'}</span></div>
        </div>
      </section>

      <section class="section" aria-labelledby="lib">
        <div class="section-head"><h2 class="h2" id="lib">Übungsbibliothek</h2><span class="muted small">{PHYSIO.length} Übungen</span></div>
        <div class="chips" role="group" aria-label="Status">
          <button class="chip-btn" aria-pressed={filter === null} onClick={() => setFilter(null)}>Alle</button>
          {TIER_ORDER.map((t) => <button key={t} class="chip-btn" aria-pressed={filter === t} onClick={() => setFilter(filter === t ? null : t)}>{TIER_LABELS[t].label} · {PHYSIO.filter((x) => tierOf(x, data.settings) === t).length}</button>)}
        </div>
        {filter && <p class="muted small" style={{ margin: 'var(--space-2) 0 0' }}>{TIER_LABELS[filter].long}.</p>}
        <div class="list" style={{ marginTop: 'var(--space-3)' }}>
          {list.map((x) => (
            <a key={x.id} class="row lib-row" href={href({ name: 'exerciseInfo', id: x.id })}>
              <div class="row-main">
                <b>{x.name}</b>
                <small>{x.dose}</small>
                <small>{KNEE_LOAD_LABELS[x.kneeLoad]}</small>
              </div>
              <TierChip tier={tierOf(x, data.settings)} />
              <Icon name="chevron" size={18} class="chevron" />
            </a>
          ))}
        </div>
      </section>

      {kneeOpen && <KneeSheet onClose={() => setKneeOpen(false)} />}
    </main>
  );
}
