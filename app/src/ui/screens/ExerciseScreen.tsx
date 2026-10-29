import { useRef, useState } from 'preact/hooks';
import { CATEGORY_LABELS, EQUIPMENT_LABELS, METRIC_LABELS, muscleText, tierOf } from '../../domain/catalog';
import { formatDate } from '../../domain/dates';
import { clock, fmtNum } from '../../domain/format';
import { exerciseHistory, personalBests, setsSummary, suggestedWeight } from '../../domain/history';
import { RACE_STATIONS } from '../../domain/hyrox';
import { lightOf } from '../../domain/knee';
import { runStep } from '../../domain/running';
import type { ExerciseDef, SessionExercise, SetEntry } from '../../domain/types';
import { kneeOf } from '../../state/knee';
import { activeSession, useAppState } from '../../state/store';
import {
  addWorkoutSet, applyPreviousSets, moveInWorkout, removeFromWorkout, removeWorkoutSet, replaceInWorkout,
  toggleSetDone, updateWorkoutSet, useLookup,
} from '../../state/workout';
import { Notice, Sheet, TierChip } from '../components';
import { Icon } from '../icons';
import { href, navigate } from '../router';
import { ExerciseMedia } from '../ExerciseMedia';
import { ExercisePicker, kneeWarning, NumberField, Technique, TimeField } from '../workout-parts';

/** First repetition number in a dose text like "3 × 5–6". */
export function targetReps(dose: string): number | null {
  const m = /×\s*(\d+)/.exec(dose);
  return m ? Number(m[1]) : null;
}

/** The per-set part of a dose text: "3 × 5–6, …" → "5–6", "4–6 × 250 m ruhig" → "250 m". */
export function perSet(dose: string): string | null {
  const m = /×\s*([\d–,.]+(?:\s*(?:m|Sek\.|Min\.|Wdh\.))?)/.exec(dose);
  return m ? m[1]!.trim() : null;
}

function SetRow({ ex, set, index, suggestion, showWeight, onToggle }: {
  ex: SessionExercise; set: SetEntry; index: number; suggestion: SetEntry | undefined; showWeight: boolean;
  onToggle: (set: SetEntry, suggestion: SetEntry | undefined, focus: () => void) => void;
}) {
  const valueId = `v-${set.id}`;
  const unit = METRIC_LABELS[ex.metric];
  return (
    <tr class={set.done ? 'set-done' : ''}>
      <th scope="row" class="set-no">{index + 1}</th>
      {showWeight && (
        <td><NumberField decimal value={set.weightKg} label={`Gewicht Satz ${index + 1} in kg`} placeholder={suggestion?.weightKg != null ? fmtNum(suggestion.weightKg) : 'kg'} onCommit={(v) => updateWorkoutSet(ex.id, set.id, { weightKg: v })} /></td>
      )}
      <td><NumberField id={valueId} decimal={ex.metric !== 'reps'} value={set.value} label={`${unit.long} Satz ${index + 1}`} placeholder={suggestion?.value != null ? fmtNum(suggestion.value) : unit.short} onCommit={(v) => updateWorkoutSet(ex.id, set.id, { value: v, ...(v === null && set.timeSec === null ? { done: false } : {}) })} /></td>
      {ex.timed && (
        <td><TimeField value={set.timeSec} label={`Zeit Satz ${index + 1} (Minuten:Sekunden)`} placeholder={suggestion?.timeSec != null ? clock(suggestion.timeSec) : 'm:ss'} onCommit={(v) => updateWorkoutSet(ex.id, set.id, { timeSec: v, ...(v === null && set.value === null ? { done: false } : {}) })} /></td>
      )}
      <td class="set-check-cell">
        <button class={`set-check${set.done ? ' checked' : ''}`} aria-pressed={set.done} aria-label={`Satz ${index + 1} ${set.done ? 'nicht mehr abhaken' : 'abhaken'}`}
          onClick={() => onToggle(set, suggestion, () => document.getElementById(valueId)?.focus())}>
          <Icon name="check" size={20} />
        </button>
      </td>
    </tr>
  );
}

function Recommendation({ def, ex, bestE1rm, runStepTitle }: { def: ExerciseDef | undefined; ex: SessionExercise; bestE1rm: number | null; runStepTitle: string | null }) {
  const reps = def ? targetReps(def.dose) : null;
  const weight = def?.weighted && ex.metric === 'reps' && bestE1rm && reps ? suggestedWeight(bestE1rm, reps) : null;
  const race = def?.station ? RACE_STATIONS[def.station] : null;
  return (
    <section class="rec" aria-label="Richtwert">
      <div class="rec-main">
        <div><b class="tabular">{ex.sets.length}</b><span>Sätze</span></div>
        <div><b class="tabular">{(def && perSet(def.dose)) ?? '–'}</b><span>pro Satz{def && perSet(def.dose) && /^[\d–,.]+$/.test(perSet(def.dose)!) ? ` (${METRIC_LABELS[ex.metric].short})` : ''}</span></div>
        <div><b class="tabular">{def?.restSeconds ? clock(def.restSeconds) : '–'}</b><span>Pause</span></div>
      </div>
      <p class="rec-note"><b>Richtwert:</b> {runStepTitle ?? def?.dose ?? 'Eigene Übung'}.{weight ? ` Gewicht etwa ${fmtNum(weight)} kg (aus deinem besten Satz geschätzt, 2–3 Wdh. Reserve).` : ''}</p>
      {race && <p class="rec-note"><b>Im Rennen:</b> {race.amount} {race.unit}{race.load ? ` · ${race.load} (Mixed Doubles)` : ''}.</p>}
    </section>
  );
}

export function ExerciseScreen({ id }: { id: string }) {
  const state = useAppState();
  const lookup = useLookup();
  const session = activeSession(state);
  const [replacing, setReplacing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [hint, setHint] = useState('');
  const hintTimer = useRef<number | undefined>(undefined);
  const index = session?.exercises.findIndex((x) => x.id === id) ?? -1;
  const ex = session && index >= 0 ? session.exercises[index]! : null;

  if (!session || !ex) {
    return (
      <main class="screen">
        <div class="empty"><h1 class="h3">Übung nicht im laufenden Training</h1>
          <p class="muted small">Vielleicht wurde das Training bereits abgeschlossen oder die Übung entfernt.</p>
          <a class="btn btn-primary" href={href({ name: 'workout' })} style={{ marginTop: 'var(--space-3)' }}>Zum Training</a></div>
      </main>
    );
  }

  const { settings } = state.data;
  const def = lookup(ex.exerciseId);
  const light = session.kneeBefore !== null ? lightOf(session.kneeBefore, settings) : kneeOf(state).light;
  const warning = def ? kneeWarning(def, settings, light) : null;
  const history = exerciseHistory(state.data.sessions, ex.exerciseId, session.id);
  const last = history[0];
  const pb = personalBests(history, ex.metric);
  const showWeight = def?.weighted ?? ex.sets.some((s) => s.weightKg !== null);
  const canCopy = Boolean(last) && ex.sets.some((s) => s.value === null && s.weightKg === null && s.timeSec === null && !s.done);
  const next = session.exercises[index + 1];
  const prev = session.exercises[index - 1];
  const unit = METRIC_LABELS[ex.metric];
  const restSeconds = def?.restSeconds ?? settings.restSeconds;

  const onToggle = (set: SetEntry, suggestion: SetEntry | undefined, focus: () => void) => {
    if (!toggleSetDone(ex.id, set, suggestion, restSeconds, settings.restAuto)) {
      setHint(`Trage zuerst ${ex.timed ? `${unit.long} oder Zeit` : unit.long} ein.`);
      window.clearTimeout(hintTimer.current);
      hintTimer.current = window.setTimeout(() => setHint(''), 3000);
      focus();
    }
  };

  return (
    <main class="screen screen-exercise">
      <div class="topbar">
        <a class="btn btn-ghost" href={href({ name: 'workout' })} style={{ marginLeft: 'calc(-1 * var(--space-2))' }}><Icon name="back" size={18} />Training</a>
        <span class="muted small tabular">{index + 1} / {session.exercises.length}</span>
      </div>

      <header style={{ marginBottom: 'var(--space-3)' }}>
        <h1 class="title title-m">{ex.name}</h1>
        <p class="muted small" style={{ margin: 'var(--space-1) 0 0' }}>
          {def ? `${CATEGORY_LABELS[def.category]} · ${muscleText(def)}` : 'Eigene / unbekannte Übung'}
          {def && def.equipment.length > 0 && ` · ${def.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ')}`}
        </p>
        {def && tierOf(def, settings) !== 'basis' && <div style={{ marginTop: 'var(--space-2)' }}><TierChip tier={tierOf(def, settings)} /></div>}
      </header>

      {warning && <div style={{ marginBottom: 'var(--space-3)' }}><Notice tone="warn" title="Knie"><p>{warning}</p></Notice></div>}

      <Recommendation def={def} ex={ex} bestE1rm={pb.bestE1rm?.kg ?? null} runStepTitle={ex.exerciseId === 'run-walk-intervals' ? runStep(settings.runStep).title : null} />

      <ExerciseMedia def={def} />

      <section class="card sets-card" aria-label="Sätze erfassen">
        <table class="set-table">
          <colgroup><col class="col-no" />{showWeight && <col />}<col />{ex.timed && <col />}<col class="col-check" /></colgroup>
          <thead>
            <tr>
              <th scope="col">Satz</th>
              {showWeight && <th scope="col">kg</th>}
              <th scope="col">{unit.long}</th>
              {ex.timed && <th scope="col">Zeit</th>}
              <th scope="col"><span class="visually-hidden">Abgehakt</span></th>
            </tr>
          </thead>
          <tbody>
            {ex.sets.map((set, i) => (
              <SetRow key={set.id} ex={ex} set={set} index={i} suggestion={last?.sets[i] ?? last?.sets.at(-1)} showWeight={showWeight} onToggle={onToggle} />
            ))}
          </tbody>
        </table>
        {hint && <p class="hint" role="status">{hint}</p>}
        <div class="btn-row set-actions">
          <button class="btn btn-secondary btn-sm" onClick={() => addWorkoutSet(ex.id)}><Icon name="plus" size={16} />Satz</button>
          {ex.sets.length > 1 && <button class="btn btn-secondary btn-sm" onClick={() => removeWorkoutSet(ex.id, ex.sets.at(-1)!.id)}><Icon name="minus" size={16} />Satz</button>}
          {canCopy && <button class="btn btn-secondary btn-sm" onClick={() => applyPreviousSets(ex.id, last!.sets)}><Icon name="copy" size={16} />Letzte Werte</button>}
        </div>
        {ex.note && <p class="muted small" style={{ margin: 'var(--space-2) 0 0' }}>{ex.note}</p>}
      </section>

      <section class="card perf" aria-label="Letztes Training und Bestleistung">
        {last ? (
          <dl class="kv">
            <dt>Letztes Mal · {formatDate(last.session.date, { day: 'numeric', month: 'short' })}</dt>
            <dd>{setsSummary(last.sets, ex.metric)}</dd>
            {pb.heaviest && <><dt>Schwerster Satz</dt><dd>{fmtNum(pb.heaviest.weightKg)} kg × {fmtNum(pb.heaviest.value)}</dd></>}
            {pb.bestE1rm && <><dt>Geschätztes 1RM</dt><dd>{fmtNum(Math.round(pb.bestE1rm.kg))} kg</dd></>}
            {pb.fastest && <><dt>Schnellster Satz</dt><dd>{fmtNum(pb.fastest.value)} {unit.short} in {clock(pb.fastest.timeSec)}</dd></>}
          </dl>
        ) : (
          <p class="muted small" style={{ margin: 0 }}>Erstes Mal mit dieser Übung – heute legst du deinen Startwert fest.</p>
        )}
      </section>

      <details class="card details">
        <summary>Technik & Sicherheit</summary>
        {def ? <Technique def={def} /> : <p class="muted small">Für diese Übung ist keine Anleitung hinterlegt.</p>}
      </details>

      <div class="btn-row" style={{ marginTop: 'var(--space-3)' }}>
        <button class="btn btn-secondary btn-sm" disabled={!prev} onClick={() => moveInWorkout(ex.id, -1)} aria-label="Nach oben verschieben"><Icon name="up" size={16} />Früher</button>
        <button class="btn btn-secondary btn-sm" disabled={!next} onClick={() => moveInWorkout(ex.id, 1)} aria-label="Nach unten verschieben"><Icon name="down" size={16} />Später</button>
        <button class="btn btn-secondary btn-sm" onClick={() => setReplacing(true)}><Icon name="swap" size={16} />Ersetzen</button>
        <button class="btn btn-secondary btn-sm" onClick={() => setConfirmRemove(true)}><Icon name="trash" size={16} />Entfernen</button>
      </div>

      <nav class="exercise-nav" aria-label="Übungen wechseln">
        <a class="btn btn-secondary" href={href({ name: 'workout' })}>Übersicht</a>
        {next
          ? <a class="btn btn-primary" href={href({ name: 'exercise', id: next.id })}>Nächste: {next.name}<Icon name="chevron" size={18} /></a>
          : <a class="btn btn-primary" href={href({ name: 'workout' })}>Zum Abschluss<Icon name="chevron" size={18} /></a>}
      </nav>

      {replacing && (
        <ExercisePicker title={`${ex.name} ersetzen`} recent={[]} light={light} initialCategory={def?.category ?? null} onClose={() => setReplacing(false)}
          onPick={(d) => { replaceInWorkout(ex.id, d); setReplacing(false); }} />
      )}
      {confirmRemove && (
        <Sheet title="Übung entfernen?" onClose={() => setConfirmRemove(false)}>
          <p>{ex.name} und {ex.sets.filter((s) => s.value !== null || s.timeSec !== null).length} erfasste Sätze werden aus diesem Training entfernt.</p>
          <div class="stack">
            <button class="btn btn-danger btn-block" onClick={() => { removeFromWorkout(ex.id); navigate({ name: 'workout' }, true); }}>Entfernen</button>
            <button class="btn btn-secondary btn-block" onClick={() => setConfirmRemove(false)}>Behalten</button>
          </div>
        </Sheet>
      )}
    </main>
  );
}
