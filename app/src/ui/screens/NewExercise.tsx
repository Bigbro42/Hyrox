import { useState } from 'preact/hooks';
import { CATEGORY_LABELS, KNEE_LOAD_LABELS, LIBRARY_EXERCISES, METRIC_LABELS } from '../../domain/catalog';
import { newId } from '../../domain/ids';
import type { Category, ExerciseDef, KneeLoad, Metric } from '../../domain/types';
import { saveCustomExercise, useAppState } from '../../state/store';
import { BackLink, Notice } from '../components';
import { Icon } from '../icons';
import { navigate } from '../router';

export function NewExercise() {
  const { data } = useAppState();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('strength');
  const [metric, setMetric] = useState<Metric>('reps');
  const [weighted, setWeighted] = useState(true);
  const [timed, setTimed] = useState(false);
  const [kneeLoad, setKneeLoad] = useState<KneeLoad>('medium');
  const [dose, setDose] = useState('');
  const [description, setDescription] = useState('');
  const trimmed = name.trim();
  const exists = [...LIBRARY_EXERCISES, ...data.customExercises].some((x) => x.name.toLowerCase() === trimmed.toLowerCase());

  const save = () => {
    const def: ExerciseDef = {
      id: newId('custom'),
      name: trimmed,
      aliases: [],
      category,
      metric,
      timed,
      weighted,
      primaryMuscles: [],
      secondaryMuscles: [],
      equipment: [],
      level: 1,
      kneeLoad,
      tier: 'optional',
      dose: dose.trim(),
      sets: 3,
      restSeconds: 90,
      description: description.trim(),
      steps: [],
      mistakes: [],
      safety: '',
      easier: '',
      harder: '',
      media: null,
      source: 'custom',
      createdAt: new Date().toISOString(),
    };
    void saveCustomExercise(def);
    navigate({ name: 'exerciseInfo', id: def.id }, true);
  };

  return (
    <main class="screen">
      <BackLink to={{ name: 'library' }} label="Übungen" />
      <header class="page-head" style={{ marginTop: 'var(--space-3)' }}><div><p class="eyebrow">Eigene Übung</p><h1 class="title title-m">Neue Übung</h1></div></header>
      <div class="card">
        <label class="field" style={{ marginTop: 0 }}>
          <span>Name</span>
          <input class="input" value={name} maxLength={80} placeholder="z. B. Hip Airplane" onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        </label>
        {exists && <p class="hint">Eine Übung mit diesem Namen gibt es schon.</p>}
        <div class="two-col" style={{ marginTop: 'var(--space-4)' }}>
          <label class="field">
            <span>Bereich</span>
            <select class="select" value={category} onChange={(e) => setCategory((e.currentTarget as HTMLSelectElement).value as Category)}>
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </label>
          <label class="field">
            <span>Gemessen in</span>
            <select class="select" value={metric} onChange={(e) => setMetric((e.currentTarget as HTMLSelectElement).value as Metric)}>
              {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => <option key={m} value={m}>{METRIC_LABELS[m].long}</option>)}
            </select>
          </label>
        </div>
        <label class="field">
          <span>Kniebelastung (eigene Einschätzung)</span>
          <select class="select" value={kneeLoad} onChange={(e) => setKneeLoad((e.currentTarget as HTMLSelectElement).value as KneeLoad)}>
            {(Object.keys(KNEE_LOAD_LABELS) as KneeLoad[]).map((k) => <option key={k} value={k}>{KNEE_LOAD_LABELS[k]}</option>)}
          </select>
        </label>
        <label class="toggle" style={{ marginTop: 'var(--space-3)' }}>
          <input type="checkbox" checked={weighted} onChange={(e) => setWeighted((e.currentTarget as HTMLInputElement).checked)} />
          <span><b>Gewicht erfassen</b><small>Zusätzliches Feld für kg</small></span>
        </label>
        <label class="toggle" style={{ marginTop: 'var(--space-2)' }}>
          <input type="checkbox" checked={timed} onChange={(e) => setTimed((e.currentTarget as HTMLInputElement).checked)} />
          <span><b>Zeit erfassen</b><small>Für Stationen, Läufe und Intervalle</small></span>
        </label>
        <label class="field">
          <span>Dosierung <span class="muted small">(optional)</span></span>
          <input class="input" value={dose} maxLength={80} placeholder="z. B. 3 × 10" onInput={(e) => setDose((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label class="field">
          <span>Beschreibung <span class="muted small">(optional)</span></span>
          <textarea class="textarea" rows={3} value={description} onInput={(e) => setDescription((e.currentTarget as HTMLTextAreaElement).value)} />
        </label>
      </div>
      <div style={{ marginTop: 'var(--space-3)' }}><Notice tone="info"><p>Eigene Übungen starten mit dem Status „Optional“. Du kannst ihn in der Übungsinfo ändern.</p></Notice></div>
      <button class="btn btn-primary btn-block" style={{ marginTop: 'var(--space-4)' }} disabled={!trimmed || exists} onClick={save}><Icon name="check" size={18} />Speichern</button>
    </main>
  );
}
