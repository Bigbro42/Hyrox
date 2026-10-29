import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CATEGORY_LABELS, KNEE_LOAD_LABELS, LIBRARY_EXERCISES, muscleText, tierOf } from '../domain/catalog';
import { clock, parseClock } from '../domain/format';
import type { KneeLight } from '../domain/knee';
import { EMPTY_FILTER, filterLibrary } from '../domain/library';
import { GROUP_LABELS, type MuscleGroup } from '../domain/muscles';
import type { Category, ExerciseDef, Settings } from '../domain/types';
import { adjustRest, stopRest, useAppState } from '../state/store';
import { Notice, Sheet, TierChip } from './components';
import { Icon } from './icons';

/** Parses "12", "12,5" and "12.5"; empty means "no value". Negative or junk is rejected. */
export function parseNumber(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  return Number(t);
}

function formatNumber(n: number | null): string {
  return n === null ? '' : n.toLocaleString('de-AT', { maximumFractionDigits: 2, useGrouping: false });
}

/**
 * Input that keeps what the person types ("12," while typing 12,5) and commits valid values
 * immediately, so every keystroke is autosaved.
 */
function TextValueField<T>({ value, onCommit, label, placeholder, inputMode, parse, format, id }: {
  value: T | null;
  onCommit: (v: T | null) => void;
  label: string;
  placeholder?: string;
  inputMode: 'numeric' | 'decimal' | 'text';
  parse: (t: string) => T | null | undefined;
  format: (v: T | null) => string;
  id?: string;
}) {
  const [text, setText] = useState(format(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(format(value));
  }, [value]);
  const invalid = parse(text) === undefined;
  return (
    <input
      id={id}
      class={`num-input${invalid ? ' invalid' : ''}`}
      type="text"
      inputMode={inputMode}
      enterKeyHint="done"
      autoComplete="off"
      aria-label={label}
      aria-invalid={invalid}
      placeholder={placeholder ?? '–'}
      value={text}
      onFocus={(e) => { focused.current = true; (e.currentTarget as HTMLInputElement).select(); }}
      onBlur={() => { focused.current = false; setText(format(value)); }}
      onInput={(e) => {
        const t = (e.currentTarget as HTMLInputElement).value;
        setText(t);
        const v = parse(t);
        if (v !== undefined && v !== value) onCommit(v);
      }}
    />
  );
}

export function NumberField(props: { value: number | null; onCommit: (v: number | null) => void; label: string; placeholder?: string; decimal?: boolean; id?: string }) {
  return <TextValueField {...props} inputMode={props.decimal ? 'decimal' : 'numeric'} parse={parseNumber} format={formatNumber} />;
}

/** Duration as "m:ss" (or plain seconds). */
export function TimeField(props: { value: number | null; onCommit: (v: number | null) => void; label: string; placeholder?: string; id?: string }) {
  return <TextValueField {...props} inputMode="text" parse={parseClock} format={(v) => (v === null ? '' : clock(v))} />;
}

function useNow(active: boolean, ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

/** Floating rest timer. Stays visible across workout screens while running. */
export function RestBar() {
  const { rest } = useAppState();
  const now = useNow(rest !== null);
  const left = rest ? (rest.endsAt - now) / 1000 : 0;
  const over = rest !== null && left <= 0;
  useEffect(() => {
    if (over) navigator.vibrate?.(200);
  }, [over]);
  if (!rest) return null;
  return (
    <div class={`rest-bar${over ? ' rest-over' : ''}`} role="timer" aria-live="off" aria-label="Pausentimer">
      <div class="rest-progress" style={{ transform: `scaleX(${over ? 1 : 1 - left / rest.total})` }} />
      <div class="rest-inner">
        <div>
          <small>{over ? 'Pause vorbei' : 'Pause'}</small>
          <b class="tabular">{over ? 'Weiter geht’s' : clock(left)}</b>
        </div>
        <div class="btn-row">
          {!over && <button class="btn btn-secondary btn-sm" onClick={() => adjustRest(-15)} aria-label="15 Sekunden weniger">−15</button>}
          {!over && <button class="btn btn-secondary btn-sm" onClick={() => adjustRest(15)} aria-label="15 Sekunden mehr">+15</button>}
          <button class="btn btn-secondary btn-sm" onClick={stopRest}>{over ? 'OK' : 'Stopp'}</button>
        </div>
      </div>
    </div>
  );
}

export function ElapsedTime({ since }: { since: string | null }) {
  const now = useNow(since !== null, 1000);
  if (!since) return null;
  return <span class="tabular">{clock((now - Date.parse(since)) / 1000)}</span>;
}

/** Warning for an exercise given its release status and today's knee traffic light. */
export function kneeWarning(def: ExerciseDef, settings: Pick<Settings, 'status'>, light: KneeLight): string | null {
  const tier = tierOf(def, settings);
  if (tier === 'locked') return def.safety || 'Aktuell gesperrt – nur nach individueller Freigabe.';
  if (light === 'red' && def.kneeLoad !== 'low') return 'Knie-Ampel rot: heute lieber ersetzen oder auslassen.';
  if (light === 'yellow' && def.kneeLoad === 'high') return 'Knie-Ampel gelb: hohe Kniebelastung – nur schmerzarm oder ersetzen.';
  return null;
}

const CATEGORIES: Category[] = ['physio', 'hyrox', 'run', 'strength', 'cardio', 'mobility'];

/** Search + filters over the library. Locked exercises need an extra confirmation. */
export function ExercisePicker({ title, onPick, onClose, recent, light, initialCategory = null }: {
  title: string;
  onPick: (def: ExerciseDef) => void;
  onClose: () => void;
  recent: string[];
  light: KneeLight;
  initialCategory?: Category | null;
}) {
  const { data } = useAppState();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(initialCategory);
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [confirm, setConfirm] = useState<ExerciseDef | null>(null);
  const all = useMemo(() => [...data.customExercises, ...LIBRARY_EXERCISES], [data.customExercises]);
  const filtered = filterLibrary(all, { ...EMPTY_FILTER, query, category, group });
  const showRecent = !query.trim() && !category && !group && recent.length > 0;
  const recentDefs = showRecent ? recent.map((id) => all.find((x) => x.id === id)).filter((x): x is ExerciseDef => Boolean(x)) : [];
  const list = showRecent ? filtered.filter((x) => !recent.includes(x.id)) : filtered;

  const pick = (x: ExerciseDef) => (tierOf(x, data.settings) === 'locked' ? setConfirm(x) : onPick(x));

  const row = (x: ExerciseDef) => {
    const warning = kneeWarning(x, data.settings, light);
    const tier = tierOf(x, data.settings);
    return (
      <button key={x.id} class="row pick-row" onClick={() => pick(x)}>
        <div class="row-main">
          <b>{x.name}</b>
          <small>{CATEGORY_LABELS[x.category]} · {x.dose || muscleText(x)}</small>
          {warning && tier !== 'locked' && <small class="warn-text">{warning}</small>}
        </div>
        {tier !== 'basis' && <TierChip tier={tier} />}
        <Icon name="plus" size={20} class="chevron" />
      </button>
    );
  };

  if (confirm) {
    return (
      <Sheet title="Gesperrte Übung" onClose={() => setConfirm(null)}>
        <Notice tone="warn" title={confirm.name} icon="lock"><p>{confirm.safety || 'Diese Übung ist für dich aktuell gesperrt.'}</p></Notice>
        <p>Die Sperre kannst du in den Einstellungen oder in der Übungsinfo ändern – am besten erst nach Rücksprache mit Physio oder Sportarzt.</p>
        <div class="stack">
          <button class="btn btn-secondary btn-block" onClick={() => setConfirm(null)}>Zurück zur Auswahl</button>
          <button class="btn btn-ghost btn-block" onClick={() => onPick(confirm)}>Trotzdem hinzufügen</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={title} onClose={onClose} tall>
      <label class="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Übung suchen, z. B. SkiErg, Copenhagen" value={query} onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} aria-label="Übung suchen" />
      </label>
      <div class="chips" role="group" aria-label="Bereich">
        {CATEGORIES.map((c) => <button key={c} class="chip-btn" aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)}>{CATEGORY_LABELS[c]}</button>)}
      </div>
      <div class="chips" role="group" aria-label="Muskelgruppe">
        {(Object.keys(GROUP_LABELS) as MuscleGroup[]).map((g) => <button key={g} class="chip-btn" aria-pressed={group === g} onClick={() => setGroup(group === g ? null : g)}>{GROUP_LABELS[g]}</button>)}
      </div>
      {recentDefs.length > 0 && (
        <>
          <h3 class="eyebrow" style={{ margin: 'var(--space-4) 0 var(--space-2)' }}>Zuletzt verwendet</h3>
          <div class="list">{recentDefs.map(row)}</div>
          <h3 class="eyebrow" style={{ margin: 'var(--space-4) 0 var(--space-2)' }}>Alle Übungen</h3>
        </>
      )}
      <p class="muted small" aria-live="polite" style={{ margin: 'var(--space-3) 0 var(--space-2)' }}>{filtered.length} Übungen</p>
      {list.length ? <div class="list">{list.map(row)}</div> : (
        <div class="empty"><p class="muted small">Keine passende Übung. Versuche einen anderen Begriff oder entferne Filter.</p></div>
      )}
    </Sheet>
  );
}

/** Step-by-step guide, common mistakes, safety and variants. */
export function Technique({ def }: { def: ExerciseDef }) {
  return (
    <div class="stack technique" style={{ marginTop: 'var(--space-3)' }}>
      {def.description && <p style={{ margin: 0 }}>{def.description}</p>}
      {def.steps.length > 0 && (
        <div>
          <p class="eyebrow">Ausführung</p>
          <ol class="steps">{def.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
      )}
      {def.mistakes.length > 0 && (
        <div>
          <p class="eyebrow">Häufige Fehler</p>
          <ul class="mistakes">{def.mistakes.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
      {def.safety && (
        <div>
          <p class="eyebrow">Sicherheit · {KNEE_LOAD_LABELS[def.kneeLoad]}</p>
          <p style={{ margin: 0 }}>{def.safety}</p>
        </div>
      )}
      {(def.easier || def.harder) && (
        <dl class="kv kv-text">
          {def.easier && <><dt>Leichter</dt><dd>{def.easier}</dd></>}
          {def.harder && <><dt>Schwerer</dt><dd>{def.harder}</dd></>}
        </dl>
      )}
      <p class="muted small" style={{ margin: 0 }}>Bei zunehmenden Schmerzen abbrechen. Die Anleitung ist allgemein gehalten, nicht physiotherapeutisch geprüft und ersetzt keine persönliche Anleitung.</p>
    </div>
  );
}
