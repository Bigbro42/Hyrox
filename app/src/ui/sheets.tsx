import { useState } from 'preact/hooks';
import { today } from '../domain/dates';
import type { KneeContext, WorkoutSession } from '../domain/types';
import { useAppState } from '../state/store';
import { logFootball, logKnee } from '../state/workout';
import { Notice, PainScale, Sheet } from './components';
import { Icon } from './icons';
import { NumberField } from './workout-parts';

/** Knee check-in outside of a workout. Nothing is pre-selected. */
export function KneeSheet({ onClose, context = 'check' }: { onClose: () => void; context?: KneeContext }) {
  const { settings } = useAppState().data;
  const [pain, setPain] = useState<number | null>(null);
  const [ctx, setCtx] = useState<KneeContext>(context);
  const [note, setNote] = useState('');
  return (
    <Sheet title="Knie-Check" onClose={onClose}>
      <p>Wie stark ist der Schmerz im Knie gerade? 0 = kein Schmerz, 10 = stärkster vorstellbarer Schmerz.</p>
      <PainScale value={pain} onChange={setPain} label="Knieschmerz 0 bis 10" greenMax={settings.kneeGreenMax} yellowMax={settings.kneeYellowMax} />
      <fieldset class="field">
        <legend>Wann?</legend>
        <div class="segmented" role="group">
          {([['check', 'Jetzt'], ['morning', 'Am Morgen'], ['football', 'Nach Fußball']] as const).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={ctx === v} onClick={() => setCtx(v)}>{l}</button>
          ))}
        </div>
      </fieldset>
      <label class="field">
        <span>Notiz <span class="muted small">(optional)</span></span>
        <textarea class="textarea" rows={2} placeholder="z. B. Treppe, Stiegen, nach langem Sitzen …" value={note} onInput={(e) => setNote((e.currentTarget as HTMLTextAreaElement).value)} />
      </label>
      <div class="stack" style={{ marginTop: 'var(--space-4)' }}>
        <button class="btn btn-primary btn-block" disabled={pain === null} onClick={() => { logKnee(pain!, ctx, note); onClose(); }}>
          <Icon name="check" size={18} />Speichern
        </button>
      </div>
    </Sheet>
  );
}

/** Logs a football match or training after the fact. */
export function FootballSheet({ onClose, date, plannedRef }: { onClose: () => void; date?: string; plannedRef?: WorkoutSession['plannedRef'] }) {
  const { settings } = useAppState().data;
  const [day, setDay] = useState(date ?? today());
  const [duration, setDuration] = useState<number | null>(null);
  const [rpe, setRpe] = useState<number | null>(null);
  const [pain, setPain] = useState<number | null>(null);
  const [note, setNote] = useState('');
  return (
    <Sheet title="Fußball eintragen" onClose={onClose}>
      <label class="field">
        <span>Datum</span>
        <input class="input" type="date" value={day} max={today()} onInput={(e) => setDay((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <label class="field">
        <span>Dauer (Minuten)</span>
        <NumberField value={duration} onCommit={setDuration} label="Dauer in Minuten" placeholder="z. B. 90" />
      </label>
      <fieldset class="field">
        <legend>Wie anstrengend? <span class="muted small">(optional, 1–10)</span></legend>
        <div class="rpe" role="radiogroup" aria-label="Belastung">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rpe === n} class="rpe-btn" onClick={() => setRpe(rpe === n ? null : n)}>{n}</button>
          ))}
        </div>
      </fieldset>
      <fieldset class="field">
        <legend>Knieschmerz nach dem Spiel <span class="muted small">(0–10)</span></legend>
        <PainScale value={pain} onChange={setPain} label="Knieschmerz nach dem Fußball" greenMax={settings.kneeGreenMax} yellowMax={settings.kneeYellowMax} />
      </fieldset>
      {pain !== null && pain > settings.kneeYellowMax && (
        <Notice tone="warn" title="Deutliche Beschwerden"><p>Gönn dem Knie Ruhe und ersetze kniebelastende Übungen. Halten die Beschwerden an, lass sie sportmedizinisch oder physiotherapeutisch abklären.</p></Notice>
      )}
      <label class="field">
        <span>Notiz <span class="muted small">(optional)</span></span>
        <textarea class="textarea" rows={2} value={note} onInput={(e) => setNote((e.currentTarget as HTMLTextAreaElement).value)} />
      </label>
      <div class="stack" style={{ marginTop: 'var(--space-4)' }}>
        <button class="btn btn-primary btn-block" disabled={!day || day > today()} onClick={() => { logFootball({ date: day, durationMin: duration, rpe, kneeAfter: pain, note: note.trim(), plannedRef }); onClose(); }}>
          <Icon name="check" size={18} />Eintragen
        </button>
      </div>
    </Sheet>
  );
}
