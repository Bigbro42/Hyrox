import { useState } from 'preact/hooks';
import { activeSeries, WEEKDAYS } from '../../domain/calendar';
import { CATEGORY_LABELS, makeLookup, tierOf } from '../../domain/catalog';
import { parseDate, today } from '../../domain/dates';
import { count } from '../../domain/format';
import { DOUBLES_RULES } from '../../domain/hyrox';
import { DELOAD_WEEKS, PHASES, phaseOf, PLAN_WEEKS, planPosition, positionLabel, type Phase } from '../../domain/phases';
import { RUN_LADDER, runAdvice, runStep } from '../../domain/running';
import { TEMPLATE_IDS } from '../../domain/templates';
import type { Slot } from '../../domain/types';
import { kneeOf } from '../../state/knee';
import { activeSession, saveSettings, useAppState } from '../../state/store';
import { startFree, startTemplate } from '../../state/workout';
import { KindIcon, LightDot, Notice, Sheet, TierChip } from '../components';
import { Icon } from '../icons';
import { href } from '../router';
import { kneeWarning } from '../workout-parts';

const UNITS: { slot: Exclude<Slot, 'F'>; id: string; tab: string }[] = [
  { slot: 'A', id: TEMPLATE_IDS.A, tab: 'A · Physio' },
  { slot: 'B', id: TEMPLATE_IDS.B, tab: 'B · Kraft' },
  { slot: 'C', id: TEMPLATE_IDS.C, tab: 'C · HYROX' },
];

function PhaseSheet({ phase, onClose }: { phase: Phase; onClose: () => void }) {
  return (
    <Sheet title={`Phase ${phase.id}: ${phase.name}`} onClose={onClose}>
      <p>Wochen {phase.weeks[0]}–{phase.weeks[1]}. Fortschritt richtet sich nach Knie-Ampel und deinen Trainingsdaten, nicht nur nach dem Kalender.</p>
      <ul class="plain-list">{phase.focus.map((f) => <li key={f}>{f}</li>)}</ul>
      <dl class="kv kv-text" style={{ marginTop: 'var(--space-4)' }}>
        <dt>Einheit A</dt><dd>{phase.hints.A}</dd>
        <dt>Einheit B</dt><dd>{phase.hints.B}</dd>
        <dt>Einheit C</dt><dd>{phase.hints.C}</dd>
      </dl>
    </Sheet>
  );
}

function RunLadder() {
  const state = useAppState();
  const { settings } = state.data;
  const knee = kneeOf(state);
  const [confirm, setConfirm] = useState<'up' | 'down' | null>(null);
  const step = runStep(settings.runStep);
  const advice = runAdvice(knee.light, step.step, settings.kneeAssessed);
  const next = RUN_LADDER[step.step];
  return (
    <section class="section" aria-labelledby="run">
      <div class="section-head">
        <h2 class="h2" id="run">Laufleiter</h2>
        <span class="muted small tabular">Stufe {step.step}/{RUN_LADDER.length}</span>
      </div>
      <div class="card">
        <div class="run-steps" aria-hidden="true">
          {RUN_LADDER.map((s) => <i key={s.step} class={s.step < step.step ? 'done' : s.step === step.step ? 'now' : ''} />)}
        </div>
        <p class="eyebrow" style={{ marginTop: 'var(--space-3)' }}>Aktuelle Stufe</p>
        <h3 class="h3">{step.title}</h3>
        <p class="muted small" style={{ margin: 'var(--space-1) 0 var(--space-3)' }}>{step.detail} · ca. {step.minutes} Min.</p>
        <div class={`advice advice-${advice.action}`}><LightDot light={knee.light} label={false} /><p>{advice.text}</p></div>
        <div class="btn-row" style={{ marginTop: 'var(--space-3)' }}>
          {advice.action === 'up' && next && <button class="btn btn-secondary btn-sm" onClick={() => setConfirm('up')}><Icon name="up" size={16} />Nächste Stufe</button>}
          {step.step > 1 && <button class="btn btn-secondary btn-sm" onClick={() => setConfirm('down')}><Icon name="down" size={16} />Stufe zurück</button>}
        </div>
        <p class="muted small" style={{ margin: 'var(--space-3) 0 0' }}>Regel: Schmerz beim Laufen höchstens 2/10, am nächsten Morgen nicht schlechter, höchstens eine Stufe pro Woche. Mit deinem Physio abstimmen.</p>
      </div>
      {confirm && (
        <Sheet title={confirm === 'up' ? 'Nächste Stufe?' : 'Eine Stufe zurück?'} onClose={() => setConfirm(null)}>
          <p>{confirm === 'up'
            ? `Neu: ${next?.title}. Bestätige nur, wenn die aktuelle Stufe zweimal beschwerdearm war und dein Knie am nächsten Morgen nicht schlechter war.`
            : `Zurück zu: ${runStep(step.step - 1).title}. Das ist kein Rückschritt, sondern Belastungssteuerung.`}</p>
          <div class="stack">
            <button class="btn btn-primary btn-block" onClick={() => { void saveSettings({ runStep: step.step + (confirm === 'up' ? 1 : -1) }); setConfirm(null); }}>Bestätigen</button>
            <button class="btn btn-secondary btn-block" onClick={() => setConfirm(null)}>Abbrechen</button>
          </div>
        </Sheet>
      )}
    </section>
  );
}

export function Training() {
  const state = useAppState();
  const { data } = state;
  const [tab, setTab] = useState<Exclude<Slot, 'F'>>('A');
  const [phaseSheet, setPhaseSheet] = useState<Phase | null>(null);
  const knee = kneeOf(state);
  const lookup = makeLookup(data.customExercises);
  const active = activeSession(state);
  const now = today();
  const position = planPosition(data.settings, now);
  const unit = UNITS.find((u) => u.slot === tab)!;
  const template = data.templates.find((t) => t.id === unit.id);
  const series = activeSeries(data.plans, tab, now);
  const currentWeek = position.kind === 'week' ? position.week : null;

  return (
    <main class="screen">
      <header class="page-head">
        <div>
          <p class="eyebrow">Deine Routine</p>
          <h1 class="title">Training</h1>
          <p class="muted small">{positionLabel(position)}</p>
        </div>
      </header>

      {active && (
        <a class="card card-link live-card" href={href({ name: 'workout' })} style={{ marginBottom: 'var(--space-4)' }}>
          <span class="live-dot" aria-hidden="true" />
          <div class="row-main"><b>{active.title} läuft</b><small>Zum laufenden Training</small></div>
          <Icon name="chevron" size={18} class="chevron" />
        </a>
      )}

      <div class="segmented" role="group" aria-label="Einheit">
        {UNITS.map((u) => <button key={u.slot} aria-pressed={tab === u.slot} onClick={() => setTab(u.slot)}>{u.tab}</button>)}
      </div>

      {template ? (
        <section class="card-hero" aria-labelledby="tpl">
          <div class="hero-top">
            <p class="eyebrow">Einheit {tab}{series ? ` · ${WEEKDAYS[parseDate(series.startsOn).getDay()]}s` : ''}</p>
            <KindIcon kind={template.kind} />
          </div>
          <h2 class="h2 hero-title" id="tpl">{template.name}</h2>
          <p class="muted">{count(template.exercises.length, 'Übung', 'Übungen')} · ca. {template.minutes} Min.</p>
          {position.kind === 'week' && <p class="hero-hint"><Icon name="target" size={16} />{position.phase.hints[tab]}</p>}
          <ol class="tpl-list">
            {template.exercises.map((x, i) => {
              const def = lookup(x.exerciseId);
              if (!def) return <li key={i} class="tpl-item"><span class="step">{i + 1}</span><div class="row-main"><b>Unbekannte Übung</b></div></li>;
              const tier = tierOf(def, data.settings);
              const warning = kneeWarning(def, data.settings, knee.light);
              return (
                <li key={`${x.exerciseId}-${i}`}>
                  <a class="tpl-item" href={href({ name: 'exerciseInfo', id: def.id })}>
                    <span class="step">{i + 1}</span>
                    <div class="row-main">
                      <b>{def.name}</b>
                      <small>{x.sets} {x.sets === 1 ? 'Block' : 'Sätze'} · {def.dose || CATEGORY_LABELS[def.category]}</small>
                      {warning && <small class="warn-text">{warning}</small>}
                    </div>
                    {tier !== 'basis' && <TierChip tier={tier} />}
                  </a>
                </li>
              );
            })}
          </ol>
          <button class="btn btn-primary btn-block btn-lg" style={{ marginTop: 'var(--space-4)' }} onClick={() => startTemplate(template)}>
            <Icon name="play" size={18} />{active ? 'Zum laufenden Training' : 'Workout starten'}
          </button>
          <a class="btn btn-secondary btn-block" style={{ marginTop: 'var(--space-2)' }} href={href({ name: 'template', id: template.id })}><Icon name="edit" size={18} />Vorlage bearbeiten</a>
        </section>
      ) : <Notice tone="warn"><p>Diese Vorlage fehlt. Unter Einstellungen → Daten lässt sich der Standard wiederherstellen.</p></Notice>}

      <div class="btn-row" style={{ marginTop: 'var(--space-3)' }}>
        <button class="btn btn-secondary" onClick={() => startFree()}><Icon name="plus" size={18} />Freies Training</button>
        <a class="btn btn-secondary" href={href({ name: 'library' })}><Icon name="body" size={18} />Übungsbibliothek</a>
      </div>

      <RunLadder />

      <section class="section" aria-labelledby="plan">
        <div class="section-head"><h2 class="h2" id="plan">16-Wochen-Plan</h2></div>
        <div class="card">
          <div class="weeks" role="group" aria-label="Wochen des Plans">
            {Array.from({ length: PLAN_WEEKS }, (_, i) => {
              const w = i + 1;
              const p = phaseOf(w);
              return (
                <button key={w} class={`week-chip phase-${p.id}${currentWeek === w ? ' week-now' : ''}`} onClick={() => setPhaseSheet(p)} aria-label={`Woche ${w}: ${p.name}${DELOAD_WEEKS.includes(w) ? ', Entlastungswoche' : ''}`}>
                  <b>{w}</b>
                  {DELOAD_WEEKS.includes(w) && <small>Entl.</small>}
                </button>
              );
            })}
          </div>
          <ul class="phase-legend">
            {PHASES.map((p) => <li key={p.id}><i class={`phase-${p.id}`} />W{p.weeks[0]}–{p.weeks[1]} · {p.name}</li>)}
          </ul>
        </div>
      </section>

      <section class="section" aria-labelledby="doubles">
        <div class="section-head">
          <h2 class="h2" id="doubles">Mixed Doubles</h2>
          <a class="btn btn-ghost" href={href({ name: 'settings' })}>Aufteilung</a>
        </div>
        <div class="card">
          <p style={{ margin: 0 }}>{data.settings.partnerName ? `Mit ${data.settings.partnerName} beim ${data.settings.raceName}.` : `Partner oder Partnerin kannst du in den Einstellungen eintragen.`} Vorläufiges Ziel: {data.settings.targetTime} h – ein Ziel, keine Prognose.</p>
          <ul class="plain-list">{DOUBLES_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      </section>

      {phaseSheet && <PhaseSheet phase={phaseSheet} onClose={() => setPhaseSheet(null)} />}
    </main>
  );
}
