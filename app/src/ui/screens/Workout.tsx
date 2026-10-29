import { useState } from 'preact/hooks';
import { METRIC_LABELS, makeLookup } from '../../domain/catalog';
import { formatDate, parseDate } from '../../domain/dates';
import { count } from '../../domain/format';
import { exerciseHistory } from '../../domain/history';
import { lightOf } from '../../domain/knee';
import { planPosition } from '../../domain/phases';
import { elapsedMinutes, hasLoggedWork } from '../../domain/session';
import { KIND_LABELS } from '../../domain/templates';
import type { WorkoutSession } from '../../domain/types';
import { today } from '../../domain/dates';
import { kneeOf } from '../../state/knee';
import { activeSession, useAppState } from '../../state/store';
import { addToWorkout, finishWorkout, leaveWorkout, removeFromWorkout, setKneeBefore, setWorkoutTitle } from '../../state/workout';
import { LightDot, Notice, PainScale, ProgressBar, Sheet } from '../components';
import { Icon } from '../icons';
import { href, navigate } from '../router';
import { ElapsedTime, ExercisePicker, kneeWarning, NumberField } from '../workout-parts';

function recentExerciseIds(sessions: readonly WorkoutSession[], limit = 8): string[] {
  const ids: string[] = [];
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    for (const x of s.exercises) if (!ids.includes(x.exerciseId)) ids.push(x.exerciseId);
    if (ids.length >= limit) break;
  }
  return ids.slice(0, limit);
}

function FinishSheet({ session, onClose }: { session: WorkoutSession; onClose: () => void }) {
  const { settings } = useAppState().data;
  const original = session.reopened?.original;
  const [rpe, setRpe] = useState<number | null>(session.rpe);
  const [note, setNote] = useState(session.note);
  const [kneeAfter, setKneeAfter] = useState<number | null>(session.kneeAfter);
  const [duration, setDuration] = useState<number | null>(original?.durationMin ?? elapsedMinutes(session, new Date()));
  const empty = !hasLoggedWork(session);
  const rise = kneeAfter !== null && session.kneeBefore !== null ? kneeAfter - session.kneeBefore : 0;
  return (
    <Sheet title={original ? 'Korrektur speichern' : 'Training abschließen'} onClose={onClose}>
      {empty && <Notice tone="warn" title="Noch keine Sätze erfasst"><p>Du kannst trotzdem abschließen, z. B. für ein Training ohne Zahlen.</p></Notice>}
      <fieldset class="field">
        <legend>Knieschmerz jetzt, nach dem Training <span class="muted small">(0–10)</span></legend>
        <PainScale value={kneeAfter} onChange={setKneeAfter} label="Knieschmerz nach dem Training" greenMax={settings.kneeGreenMax} yellowMax={settings.kneeYellowMax} />
        {kneeAfter !== null && (rise >= 2 || lightOf(kneeAfter, settings) === 'red') && (
          <Notice tone="warn" title="Das Knie hat reagiert">
            <p>{rise >= 2 ? `Der Schmerz ist von ${session.kneeBefore} auf ${kneeAfter} gestiegen. ` : ''}Nächstes Mal die auslösenden Übungen ersetzen oder die Belastung senken. Bleibt es so, bitte abklären lassen.</p>
          </Notice>
        )}
      </fieldset>
      <label class="field">
        <span>Dauer (Minuten)</span>
        <NumberField value={duration} onCommit={setDuration} label="Dauer in Minuten" />
      </label>
      <fieldset class="field">
        <legend>Wie anstrengend war es? <span class="muted small">(optional, 1 = sehr leicht, 10 = maximal)</span></legend>
        <div class="rpe" role="radiogroup" aria-label="Belastung">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rpe === n} class="rpe-btn" onClick={() => setRpe(rpe === n ? null : n)}>{n}</button>
          ))}
        </div>
      </fieldset>
      <label class="field">
        <span>Notiz</span>
        <textarea class="textarea" rows={3} placeholder="Wie lief es? Schlaf, Energie, Stress …" value={note} onInput={(e) => setNote((e.currentTarget as HTMLTextAreaElement).value)} />
      </label>
      <div class="stack" style={{ marginTop: 'var(--space-4)' }}>
        <button class="btn btn-primary btn-block" onClick={() => finishWorkout({ rpe, note: note.trim(), durationMin: duration, kneeAfter })}>
          <Icon name="check" size={18} />{original ? 'Korrektur speichern' : 'Abschließen'}
        </button>
        <button class="btn btn-secondary btn-block" onClick={onClose}>Weiter trainieren</button>
      </div>
    </Sheet>
  );
}

function NoWorkout() {
  return (
    <main class="screen">
      <header class="page-head"><div><p class="eyebrow">Training</p><h1 class="title">Kein Training aktiv</h1></div></header>
      <div class="empty">
        <p class="muted small">Starte eine Einheit unter „Training“ oder aus dem Kalender.</p>
        <a class="btn btn-primary" href={href({ name: 'training' })} style={{ marginTop: 'var(--space-3)' }}>Zum Training</a>
      </div>
    </main>
  );
}

export function Workout() {
  const state = useAppState();
  const { data } = state;
  const session = activeSession(state);
  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  if (!session) return <NoWorkout />;

  const knee = kneeOf(state);
  const lookup = makeLookup(data.customExercises);
  const correcting = Boolean(session.reopened);
  const totalSets = session.exercises.reduce((n, x) => n + x.sets.length, 0);
  const doneSets = session.exercises.reduce((n, x) => n + x.sets.filter((s) => s.done).length, 0);
  const light = session.kneeBefore !== null ? lightOf(session.kneeBefore, data.settings) : knee.light;
  const flagged = session.exercises.filter((x) => {
    const def = lookup(x.exerciseId);
    return def && kneeWarning(def, data.settings, light);
  });
  const position = planPosition(data.settings, today());
  const template = data.templates.find((t) => t.id === session.templateId);
  const slot = template?.id === 'tpl-physio' ? 'A' : template?.id === 'tpl-strength' ? 'B' : template?.id === 'tpl-hyrox' ? 'C' : null;

  return (
    <main class="screen">
      <header class="workout-head">
        <div class="workout-meta">
          <span class="live-dot" aria-hidden="true" />
          <span>{correcting ? `Korrektur · ${formatDate(session.date)}` : <>Läuft · <ElapsedTime since={session.startedAt} /></>}</span>
          <span class="muted"> · {KIND_LABELS[session.kind]}</span>
        </div>
        {editingTitle ? (
          <input class="title-input" aria-label="Name des Trainings" defaultValue={session.title} autoFocus
            onBlur={(e) => { setWorkoutTitle((e.currentTarget as HTMLInputElement).value); setEditingTitle(false); }}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
        ) : (
          <button class="title-btn" onClick={() => setEditingTitle(true)} aria-label={`${session.title} – umbenennen`}>
            <h1 class="title">{session.title}</h1><Icon name="edit" size={18} />
          </button>
        )}
        {slot && position.kind === 'week' && <p class="muted small" style={{ margin: 0 }}><Icon name="target" size={14} /> {position.phase.hints[slot]}</p>}
      </header>

      {!correcting && (
        <section class="card knee-before" aria-labelledby="kb">
          <div class="knee-head">
            <p class="eyebrow" id="kb">Knie vor dem Training</p>
            {session.kneeBefore !== null && <LightDot light={lightOf(session.kneeBefore, data.settings)} />}
          </div>
          <PainScale value={session.kneeBefore} onChange={setKneeBefore} label="Knieschmerz vor dem Training" greenMax={data.settings.kneeGreenMax} yellowMax={data.settings.kneeYellowMax} />
          {session.kneeBefore === null && <p class="muted small" style={{ margin: 'var(--space-2) 0 0' }}>Optional, hilft aber: Nach dem Training fragt die App noch einmal und vergleicht.</p>}
        </section>
      )}

      {flagged.length > 0 && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Notice tone="warn" title={light === 'red' ? 'Knie-Ampel rot: heute anpassen' : 'Hinweis zur Kniebelastung'}>
            <p>{flagged.map((x) => x.name).join(', ')} {flagged.length === 1 ? 'belastet' : 'belasten'} das Knie stärker oder {flagged.length === 1 ? 'ist' : 'sind'} für dich gesperrt. Ersetze die Übung in der Übungsansicht oder entferne sie.</p>
            {light === 'red' && (
              <button class="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-2)' }} onClick={() => flagged.filter((x) => !x.sets.some((s) => s.value !== null || s.timeSec !== null)).forEach((x) => removeFromWorkout(x.id))}>
                Unbearbeitete davon entfernen
              </button>
            )}
          </Notice>
        </div>
      )}

      {totalSets > 0 && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <ProgressBar value={doneSets} max={totalSets} label={`${doneSets} von ${totalSets} Sätzen abgehakt`} />
          <p class="muted small tabular" style={{ margin: 'var(--space-1) 0 0' }}>{doneSets}/{totalSets} Sätze</p>
        </div>
      )}

      <section class="section" style={{ marginTop: 'var(--space-3)' }} aria-label="Übungen">
        {session.exercises.length ? (
          <ol class="list exercise-list">
            {session.exercises.map((x, i) => {
              const done = x.sets.filter((s) => s.done).length;
              const complete = done === x.sets.length && done > 0;
              const last = exerciseHistory(data.sessions, x.exerciseId, session.id)[0];
              const def = lookup(x.exerciseId);
              const warn = def && kneeWarning(def, data.settings, light);
              return (
                <li key={x.id}>
                  <a class="row" href={href({ name: 'exercise', id: x.id })}>
                    <span class={`step${complete ? ' step-done' : ''}`} aria-hidden="true">{complete ? <Icon name="check" size={16} /> : i + 1}</span>
                    <div class="row-main">
                      <b>{x.name}</b>
                      <small>{done}/{x.sets.length} Sätze · {METRIC_LABELS[x.metric].long}{last ? ` · zuletzt ${parseDate(last.session.date).toLocaleDateString('de-AT', { day: 'numeric', month: 'short' })}` : ''}</small>
                    </div>
                    {warn && <Icon name="alert" size={18} class="warn-icon" aria-label="Kniehinweis" />}
                    <Icon name="chevron" size={18} class="chevron" />
                  </a>
                </li>
              );
            })}
          </ol>
        ) : (
          <div class="empty">
            <h2 class="h3">Noch keine Übungen</h2>
            <p class="muted small">Füge die erste Übung hinzu – über Suche, Bereich oder Muskelgruppe.</p>
          </div>
        )}
        <button class="btn btn-secondary btn-block" style={{ marginTop: 'var(--space-3)' }} onClick={() => setPicking(true)}>
          <Icon name="plus" size={18} />Übung hinzufügen
        </button>
      </section>

      <div class="stack" style={{ marginTop: 'var(--space-6)' }}>
        <button class="btn btn-primary btn-block btn-lg" onClick={() => setFinishing(true)}>
          <Icon name="flag" size={18} />{correcting ? 'Korrektur speichern' : 'Training abschließen'}
        </button>
        <button class="btn btn-ghost btn-block" onClick={() => setLeaving(true)}>{correcting ? 'Korrektur verwerfen' : 'Beenden ohne Abschluss'}</button>
      </div>

      {picking && (
        <ExercisePicker title="Übung hinzufügen" recent={recentExerciseIds(data.sessions)} light={light}
          onClose={() => setPicking(false)}
          onPick={(def) => { const id = addToWorkout(def); setPicking(false); if (id) navigate({ name: 'exercise', id }); }} />
      )}
      {finishing && <FinishSheet session={session} onClose={() => setFinishing(false)} />}
      {leaving && (
        <Sheet title={correcting ? 'Korrektur verwerfen?' : 'Ohne Abschluss beenden?'} onClose={() => setLeaving(false)}>
          <p>
            {correcting
              ? 'Alle Änderungen dieser Korrektur werden verworfen. Das Training bleibt so, wie es vorher war.'
              : hasLoggedWork(session) || session.kneeBefore !== null
                ? 'Deine Einträge bleiben als „Nicht abgeschlossen“ im Verlauf und zählen nicht als Training. Du kannst später fortsetzen.'
                : `Es wurde nichts erfasst. Das leere Training (${count(session.exercises.length, 'Übung', 'Übungen')}) wird verworfen.`}
          </p>
          <div class="stack">
            <button class="btn btn-danger btn-block" onClick={leaveWorkout}>{correcting ? 'Verwerfen' : 'Beenden'}</button>
            <button class="btn btn-secondary btn-block" onClick={() => setLeaving(false)}>Zurück</button>
          </div>
        </Sheet>
      )}
    </main>
  );
}
