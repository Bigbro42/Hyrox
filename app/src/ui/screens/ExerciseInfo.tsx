import { useState } from 'preact/hooks';
import { CATEGORY_LABELS, EQUIPMENT_LABELS, KNEE_LOAD_LABELS, METRIC_LABELS, muscleText, tierOf, TIER_LABELS, TIER_ORDER } from '../../domain/catalog';
import { formatDate } from '../../domain/dates';
import { clock, fmtNum } from '../../domain/format';
import { exerciseHistory, personalBests, setsSummary } from '../../domain/history';
import { RACE_STATIONS, RULES_SOURCE } from '../../domain/hyrox';
import type { Tier } from '../../domain/types';
import { activeSession, saveSettings, saveTemplate, useAppState } from '../../state/store';
import { addToWorkout, useLookup } from '../../state/workout';
import { BackLink, Notice, Sheet, TierChip } from '../components';
import { ExerciseMedia } from '../ExerciseMedia';
import { Icon } from '../icons';
import { href, navigate } from '../router';
import { Technique } from '../workout-parts';

export function ExerciseInfo({ id }: { id: string }) {
  const state = useAppState();
  const { data } = state;
  const lookup = useLookup();
  const def = lookup(id);
  const [statusSheet, setStatusSheet] = useState(false);
  const [templateSheet, setTemplateSheet] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  if (!def) {
    return (
      <main class="screen">
        <BackLink to={{ name: 'library' }} label="Übungen" />
        <div class="empty" style={{ marginTop: 'var(--space-4)' }}><h1 class="h3">Übung nicht gefunden</h1></div>
      </main>
    );
  }
  const tier = tierOf(def, data.settings);
  const history = exerciseHistory(data.sessions, def.id);
  const pb = personalBests(history, def.metric);
  const active = activeSession(state);
  const race = def.station ? RACE_STATIONS[def.station] : null;
  const back = def.category === 'physio' ? { to: { name: 'physio' } as const, label: 'Physio' } : { to: { name: 'library' } as const, label: 'Übungen' };

  const setTier = (t: Tier) => {
    const status = { ...data.settings.status };
    if (t === def.tier) delete status[def.id];
    else status[def.id] = t;
    void saveSettings({ status });
    setStatusSheet(false);
  };

  return (
    <main class="screen">
      <BackLink to={back.to} label={back.label} />
      <header style={{ margin: 'var(--space-3) 0' }}>
        <p class="eyebrow">{CATEGORY_LABELS[def.category]}{def.source === 'custom' ? ' · Eigene Übung' : ''}</p>
        <h1 class="title title-m">{def.name}</h1>
        <p class="muted small" style={{ margin: 'var(--space-1) 0 0' }}>{muscleText(def)}{def.equipment.length ? ` · ${def.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ')}` : ''}</p>
        <div class="facts">
          <TierChip tier={tier} />
          <span class="chip chip-neutral">{KNEE_LOAD_LABELS[def.kneeLoad]}</span>
          <span class="chip chip-neutral">Stufe {def.level}/3</span>
        </div>
      </header>

      {tier === 'locked' && <Notice tone="warn" title="Aktuell gesperrt" icon="lock"><p>{def.safety || TIER_LABELS.locked.long}</p></Notice>}

      <section class="rec" aria-label="Dosierung" style={{ marginTop: 'var(--space-3)' }}>
        <p class="rec-note" style={{ margin: 0 }}><b>Dosierung:</b> {def.dose || 'Nach eigener Planung'} · erfasst in {METRIC_LABELS[def.metric].long}{def.timed ? ' und Zeit' : ''}</p>
        {race && <p class="rec-note"><b>Im Rennen (Mixed Doubles):</b> {race.amount} {race.unit}{race.load ? ` · ${race.load}` : ''}. Quelle: {RULES_SOURCE}, bitte prüfen.</p>}
      </section>

      <ExerciseMedia def={def} />

      <section class="card" style={{ marginTop: 'var(--space-3)' }} aria-label="Anleitung">
        <Technique def={def} />
      </section>

      <section class="card" style={{ marginTop: 'var(--space-3)' }} aria-label="Status für dich">
        <div class="knee-head">
          <div><p class="eyebrow">Status für dich</p><b>{TIER_LABELS[tier].label}</b></div>
          <button class="btn btn-secondary btn-sm" onClick={() => setStatusSheet(true)}>Ändern</button>
        </div>
        <p class="muted small" style={{ margin: 'var(--space-2) 0 0' }}>{TIER_LABELS[tier].long}.{tier !== def.tier ? ` Standard wäre: ${TIER_LABELS[def.tier].label}.` : ''}</p>
      </section>

      {history.length > 0 && (
        <section class="section" aria-labelledby="hist">
          <div class="section-head"><h2 class="h2" id="hist">Dein Verlauf</h2></div>
          <div class="card">
            <dl class="kv">
              {pb.heaviest && <><dt>Schwerster Satz</dt><dd>{fmtNum(pb.heaviest.weightKg)} kg × {fmtNum(pb.heaviest.value)}</dd></>}
              {pb.bestE1rm && <><dt>Geschätztes 1RM</dt><dd>{fmtNum(Math.round(pb.bestE1rm.kg))} kg</dd></>}
              {pb.fastest && <><dt>Schnellster Satz</dt><dd>{fmtNum(pb.fastest.value)} {METRIC_LABELS[def.metric].short} in {clock(pb.fastest.timeSec)}</dd></>}
            </dl>
            <ul class="history-list">
              {history.slice(0, 8).map((e) => (
                <li key={e.exercise.id}><a href={href({ name: 'session', id: e.session.id })}><span>{formatDate(e.session.date, { day: 'numeric', month: 'short' })}</span><span>{setsSummary(e.sets, def.metric)}</span></a></li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div class="stack" style={{ marginTop: 'var(--space-5)' }}>
        {active && <button class="btn btn-primary btn-block" onClick={() => { const exId = addToWorkout(def); if (exId) navigate({ name: 'exercise', id: exId }); }}><Icon name="plus" size={18} />Ins laufende Training</button>}
        <button class="btn btn-secondary btn-block" onClick={() => setTemplateSheet(true)}><Icon name="plus" size={18} />Zu einer Vorlage hinzufügen</button>
        {added && <p class="muted small" role="status" style={{ margin: 0 }}>Zu „{added}“ hinzugefügt.</p>}
      </div>

      {statusSheet && (
        <Sheet title="Status für dich" onClose={() => setStatusSheet(false)}>
          <p>Ändere den Status nur nach Rücksprache mit Physio oder Sportarzt – vor allem bei Sprüngen und tiefer einbeiniger Beugung.</p>
          {TIER_ORDER.map((t) => (
            <label key={t} class="choice">
              <input type="radio" name="tier" checked={tier === t} onChange={() => setTier(t)} />
              <span><b>{TIER_LABELS[t].label}{t === def.tier ? ' (Standard)' : ''}</b><small>{TIER_LABELS[t].long}</small></span>
            </label>
          ))}
        </Sheet>
      )}
      {templateSheet && (
        <Sheet title="Zu welcher Vorlage?" onClose={() => setTemplateSheet(false)}>
          <div class="list">
            {data.templates.map((t) => (
              <button key={t.id} class="row" onClick={() => {
                void saveTemplate({ ...t, exercises: [...t.exercises, { exerciseId: def.id, sets: def.sets }], rev: t.rev + 1, updatedAt: new Date().toISOString() });
                setAdded(t.name);
                setTemplateSheet(false);
              }}>
                <div class="row-main"><b>{t.name}</b><small>{t.exercises.length} Übungen</small></div>
                <Icon name="plus" size={18} class="chevron" />
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </main>
  );
}
