import { useState } from 'preact/hooks';
import { makeLookup, tierOf } from '../../domain/catalog';
import { defaultTemplate } from '../../domain/templates';
import type { WorkoutTemplate } from '../../domain/types';
import { kneeOf } from '../../state/knee';
import { saveTemplate, useAppState } from '../../state/store';
import { BackLink, Notice, Sheet, TierChip } from '../components';
import { Icon } from '../icons';
import { ExercisePicker, NumberField } from '../workout-parts';

/** Editing a template only affects future workouts; completed ones keep their own copy. */
export function TemplateEditor({ id }: { id: string }) {
  const state = useAppState();
  const { data } = state;
  const [picking, setPicking] = useState(false);
  const [resetting, setResetting] = useState(false);
  const template = data.templates.find((t) => t.id === id);
  const lookup = makeLookup(data.customExercises);
  if (!template) {
    return (
      <main class="screen">
        <BackLink to={{ name: 'training' }} label="Training" />
        <div class="empty" style={{ marginTop: 'var(--space-4)' }}><h1 class="h3">Vorlage nicht gefunden</h1></div>
      </main>
    );
  }
  const update = (patch: Partial<WorkoutTemplate>) => void saveTemplate({ ...template, ...patch, rev: template.rev + 1, updatedAt: new Date().toISOString() });
  const setExercises = (exercises: WorkoutTemplate['exercises']) => update({ exercises });
  const move = (i: number, d: -1 | 1) => {
    const list = [...template.exercises];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    setExercises(list);
  };
  const fallback = defaultTemplate(template.id, new Date().toISOString());

  return (
    <main class="screen">
      <BackLink to={{ name: 'training' }} label="Training" />
      <header class="page-head" style={{ marginTop: 'var(--space-3)' }}>
        <div><p class="eyebrow">Vorlage bearbeiten</p><h1 class="title title-m">{template.name}</h1></div>
      </header>
      <Notice tone="info"><p>Änderungen gelten für künftige Trainings. Abgeschlossene Einheiten bleiben unverändert.</p></Notice>

      <div class="card" style={{ marginTop: 'var(--space-3)' }}>
        <label class="field" style={{ marginTop: 0 }}>
          <span>Name</span>
          <input class="input" value={template.name} maxLength={80} onChange={(e) => update({ name: (e.currentTarget as HTMLInputElement).value.trim() || template.name })} />
        </label>
        <label class="field">
          <span>Geplante Dauer (Minuten)</span>
          <NumberField value={template.minutes} label="Dauer in Minuten" onCommit={(v) => v !== null && v >= 5 && v <= 240 && update({ minutes: Math.round(v) })} />
        </label>
      </div>

      <section class="section" aria-labelledby="ex">
        <div class="section-head"><h2 class="h2" id="ex">Übungen</h2><span class="muted small">{template.exercises.length}</span></div>
        <ol class="list plan-list">
          {template.exercises.map((x, i) => {
            const def = lookup(x.exerciseId);
            const tier = def ? tierOf(def, data.settings) : null;
            return (
              <li key={`${x.exerciseId}-${i}`} class="row plan-ex">
                <div class="row-main">
                  <b>{def?.name ?? 'Unbekannte Übung'}</b>
                  <small>{def?.dose}</small>
                </div>
                {tier && tier !== 'basis' && <TierChip tier={tier} />}
                <div class="stepper" aria-label="Sätze">
                  <button class="icon-btn icon-btn-sm" disabled={x.sets <= 1} aria-label="Ein Satz weniger" onClick={() => setExercises(template.exercises.map((y, k) => (k === i ? { ...y, sets: y.sets - 1 } : y)))}><Icon name="minus" size={16} /></button>
                  <span class="count-value tabular" aria-label={`${x.sets} Sätze`}>{x.sets}</span>
                  <button class="icon-btn icon-btn-sm" disabled={x.sets >= 10} aria-label="Ein Satz mehr" onClick={() => setExercises(template.exercises.map((y, k) => (k === i ? { ...y, sets: y.sets + 1 } : y)))}><Icon name="plus" size={16} /></button>
                </div>
                <div class="stepper">
                  <button class="icon-btn icon-btn-sm" disabled={i === 0} aria-label="Nach oben" onClick={() => move(i, -1)}><Icon name="up" size={16} /></button>
                  <button class="icon-btn icon-btn-sm" disabled={i === template.exercises.length - 1} aria-label="Nach unten" onClick={() => move(i, 1)}><Icon name="down" size={16} /></button>
                  <button class="icon-btn icon-btn-sm" aria-label={`${def?.name ?? 'Übung'} entfernen`} onClick={() => setExercises(template.exercises.filter((_, k) => k !== i))}><Icon name="trash" size={16} /></button>
                </div>
              </li>
            );
          })}
        </ol>
        <button class="btn btn-secondary btn-block" style={{ marginTop: 'var(--space-3)' }} onClick={() => setPicking(true)}><Icon name="plus" size={18} />Übung hinzufügen</button>
        {fallback && <button class="btn btn-ghost btn-block" style={{ marginTop: 'var(--space-2)' }} onClick={() => setResetting(true)}>Auf Standard zurücksetzen</button>}
      </section>

      {picking && (
        <ExercisePicker title="Zur Vorlage hinzufügen" recent={[]} light={kneeOf(state).light} initialCategory={template.kind === 'physio' ? 'physio' : null}
          onClose={() => setPicking(false)}
          onPick={(def) => { setExercises([...template.exercises, { exerciseId: def.id, sets: def.sets }]); setPicking(false); }} />
      )}
      {resetting && fallback && (
        <Sheet title="Standard wiederherstellen?" onClose={() => setResetting(false)}>
          <p>Name, Dauer und Übungen werden auf den Standard dieser Einheit zurückgesetzt.</p>
          <div class="stack">
            <button class="btn btn-danger btn-block" onClick={() => { void saveTemplate({ ...fallback, rev: template.rev + 1 }); setResetting(false); }}>Zurücksetzen</button>
            <button class="btn btn-secondary btn-block" onClick={() => setResetting(false)}>Abbrechen</button>
          </div>
        </Sheet>
      )}
    </main>
  );
}
