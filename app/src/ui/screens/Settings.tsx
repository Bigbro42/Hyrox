import { isIsoDate } from '../../domain/dates';
import { WEEKDAYS } from '../../domain/calendar';
import { STATION_ORDER, stationExercise } from '../../domain/catalog';
import { RULES_SOURCE } from '../../domain/hyrox';
import type { FootballDay, Settings } from '../../domain/types';
import { saveSettings, useAppState } from '../../state/store';
import { BackLink, Notice } from '../components';
import { Icon } from '../icons';
import { href } from '../router';
import { NumberField } from '../workout-parts';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const LEVELS: { v: Settings['level']; label: string }[] = [{ v: 1, label: 'Einsteiger' }, { v: 2, label: 'Fortgeschritten' }, { v: 3, label: 'Erfahren' }];

function TextSetting({ label, value, onSave, placeholder, max = 60 }: { label: string; value: string; onSave: (v: string) => void; placeholder?: string; max?: number }) {
  return (
    <label class="field">
      <span>{label}</span>
      <input class="input" value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onSave((e.currentTarget as HTMLInputElement).value.trim())} />
    </label>
  );
}

export function SettingsScreen() {
  const { data } = useAppState();
  const s = data.settings;
  const save = (patch: Partial<Settings>) => void saveSettings(patch);
  const sameDay = new Set([s.days.A, s.days.B, s.days.C]).size < 3;

  return (
    <main class="screen">
      <BackLink to={{ name: 'home' }} label="Heute" />
      <header class="page-head" style={{ marginTop: 'var(--space-3)' }}>
        <div><p class="eyebrow">Deine Angaben bleiben auf diesem Gerät</p><h1 class="title">Einstellungen</h1></div>
        <a class="icon-btn" href={href({ name: 'data' })} aria-label="Daten & Backup"><Icon name="data" size={20} /></a>
      </header>

      <section class="section" style={{ marginTop: 0 }} aria-labelledby="week">
        <h2 class="h2" id="week">Wochenplan</h2>
        <div class="card" style={{ marginTop: 'var(--space-3)' }}>
          {(['A', 'B', 'C'] as const).map((slot) => (
            <label key={slot} class="field" style={slot === 'A' ? { marginTop: 0 } : undefined}>
              <span>Einheit {slot} · {slot === 'A' ? 'Physio & Knie' : slot === 'B' ? 'Kraft & Ausdauer' : 'HYROX Mixed Doubles'}</span>
              <select class="select" value={s.days[slot]} onChange={(e) => save({ days: { ...s.days, [slot]: Number((e.currentTarget as HTMLSelectElement).value) } })}>
                {WEEK_ORDER.map((d) => <option key={d} value={d}>{WEEKDAYS[d]}</option>)}
              </select>
            </label>
          ))}
          <fieldset class="field">
            <legend>Fußball</legend>
            <div class="segmented" role="group">
              {([['thursday', 'Donnerstag'], ['sunday', 'Sonntag'], ['none', 'Pausiert']] as [FootballDay, string][]).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={s.football === v} onClick={() => save({ football: v })}>{l}</button>
              ))}
            </div>
          </fieldset>
          <p class="muted small" style={{ margin: 0 }}>Änderungen gelten ab heute; erledigte Einheiten bleiben, wie sie sind. Einzelne Termine verschiebst du im Kalender. Fußball zählt als intensive Belastung – die App warnt, wenn er direkt neben Einheit B oder C liegt.</p>
          {sameDay && <p class="hint">Zwei Einheiten liegen auf demselben Wochentag.</p>}
        </div>
      </section>

      <section class="section" aria-labelledby="race">
        <h2 class="h2" id="race">Wettkampf</h2>
        <div class="card" style={{ marginTop: 'var(--space-3)' }}>
          <TextSetting label="Rennen" value={s.raceName} onSave={(v) => save({ raceName: v || 'HYROX Wien' })} />
          <div class="two-col" style={{ marginTop: 'var(--space-4)' }}>
            <label class="field"><span>Datum</span><input class="input" type="date" value={s.raceDate} onChange={(e) => { const v = (e.currentTarget as HTMLInputElement).value; if (isIsoDate(v)) save({ raceDate: v }); }} /></label>
            <label class="field"><span>Planstart (Woche 1)</span><input class="input" type="date" value={s.planStart} onChange={(e) => { const v = (e.currentTarget as HTMLInputElement).value; if (isIsoDate(v)) save({ planStart: v }); }} /></label>
          </div>
          <div class="two-col" style={{ marginTop: 'var(--space-4)' }}>
            <TextSetting label="Kategorie" value={s.division} onSave={(v) => save({ division: v })} max={40} />
            <TextSetting label="Vorläufige Zielzeit" value={s.targetTime} onSave={(v) => save({ targetTime: v })} placeholder="1:30" max={10} />
          </div>
          <p class="muted small" style={{ margin: 'var(--space-3) 0 0' }}>Laut Eventkalendern (Stand Oktober 2026) voraussichtlich 19.–21. Februar 2027 in der Messe Wien – bitte auf hyrox.com bestätigen. Deinen Starttag siehst du in der Startliste. Die Zielzeit ist ein Ziel, keine Prognose.</p>
        </div>
      </section>

      <section class="section" aria-labelledby="doubles">
        <h2 class="h2" id="doubles">Mixed Doubles</h2>
        <div class="card" style={{ marginTop: 'var(--space-3)' }}>
          <TextSetting label="Partner oder Partnerin (optional)" value={s.partnerName} onSave={(v) => save({ partnerName: v })} placeholder="Name" />
          <p class="eyebrow" style={{ marginTop: 'var(--space-4)' }}>Geplante Aufteilung – dein Anteil</p>
          {STATION_ORDER.map((st) => (
            <label key={st} class="share-row">
              <span>{stationExercise(st).name}</span>
              <input class="range" type="range" min={0} max={100} step={10} value={s.stationShare[st]} aria-label={`Dein Anteil ${stationExercise(st).name}`}
                onChange={(e) => save({ stationShare: { ...s.stationShare, [st]: Number((e.currentTarget as HTMLInputElement).value) } })} />
              <b class="tabular">{s.stationShare[st]} %</b>
            </label>
          ))}
          <p class="muted small" style={{ margin: 'var(--space-2) 0 0' }}>Hilft beim Planen der Wechsel. Gewichte und Regeln: {RULES_SOURCE} – vor dem Rennen auf hyrox.com prüfen.</p>
        </div>
      </section>

      <section class="section" aria-labelledby="knee">
        <h2 class="h2" id="knee">Knie</h2>
        <div class="card" style={{ marginTop: 'var(--space-3)' }}>
          <div class="two-col">
            <label class="field" style={{ marginTop: 0 }}><span>Grün bis</span>
              <select class="select" value={s.kneeGreenMax} onChange={(e) => save({ kneeGreenMax: Number((e.currentTarget as HTMLSelectElement).value) })}>
                {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}/10</option>)}
              </select>
            </label>
            <label class="field" style={{ marginTop: 0 }}><span>Gelb bis</span>
              <select class="select" value={s.kneeYellowMax} onChange={(e) => save({ kneeYellowMax: Number((e.currentTarget as HTMLSelectElement).value) })}>
                {[2, 3, 4, 5, 6].filter((n) => n >= s.kneeGreenMax).map((n) => <option key={n} value={n}>{n}/10</option>)}
              </select>
            </label>
          </div>
          <label class="toggle" style={{ marginTop: 'var(--space-3)' }}>
            <input type="checkbox" checked={s.kneeAssessed} onChange={(e) => save({ kneeAssessed: (e.currentTarget as HTMLInputElement).checked })} />
            <span><b>Knie wurde abgeklärt</b><small>Nur setzen, wenn Physio oder Sportarzt die Beschwerden untersucht haben. Das gibt keine Übung automatisch frei.</small></span>
          </label>
          <a class="btn btn-ghost btn-sm" href={href({ name: 'physio' })} style={{ marginTop: 'var(--space-2)' }}>Status der Physio-Übungen<Icon name="chevron" size={16} /></a>
        </div>
      </section>

      <section class="section" aria-labelledby="profile">
        <h2 class="h2" id="profile">Profil</h2>
        <div class="card" style={{ marginTop: 'var(--space-3)' }}>
          <TextSetting label="Name (optional)" value={s.name} onSave={(v) => save({ name: v })} />
          <div class="two-col" style={{ marginTop: 'var(--space-4)' }}>
            <label class="field"><span>Geburtsjahr</span><NumberField value={s.birthYear} label="Geburtsjahr" placeholder="optional" onCommit={(v) => (v === null || (v >= 1920 && v <= 2020)) && save({ birthYear: v })} /></label>
            <label class="field"><span>Größe (cm)</span><NumberField value={s.heightCm} label="Größe in cm" placeholder="optional" onCommit={(v) => (v === null || (v >= 100 && v <= 250)) && save({ heightCm: v })} /></label>
          </div>
          <label class="field"><span>Gewicht (kg)</span><NumberField decimal value={s.weightKg} label="Gewicht in kg" placeholder="optional" onCommit={(v) => (v === null || (v >= 30 && v <= 250)) && save({ weightKg: v })} /></label>
          <fieldset class="field">
            <legend>Trainingslevel</legend>
            <div class="segmented" role="group">{LEVELS.map((l) => <button key={l.v} type="button" aria-pressed={s.level === l.v} onClick={() => save({ level: l.v })}>{l.label}</button>)}</div>
          </fieldset>
          <p class="muted small" style={{ margin: 0 }}>Alle Angaben sind freiwillig und werden nur lokal gespeichert – nichts wird hochgeladen.</p>
        </div>
      </section>

      <section class="section" aria-labelledby="training">
        <h2 class="h2" id="training">Training</h2>
        <div class="card" style={{ marginTop: 'var(--space-3)' }}>
          <label class="toggle">
            <input type="checkbox" checked={s.restAuto} onChange={(e) => save({ restAuto: (e.currentTarget as HTMLInputElement).checked })} />
            <span><b>Pausentimer automatisch starten</b><small>Nach jedem abgehakten Satz, mit der Pause der jeweiligen Übung</small></span>
          </label>
        </div>
      </section>

      <section class="section" aria-labelledby="install">
        <h2 class="h2" id="install">Als App installieren</h2>
        <div class="card" style={{ marginTop: 'var(--space-3)' }}>
          <dl class="kv kv-text">
            <dt>iPhone</dt><dd>In Safari öffnen → Teilen → „Zum Home-Bildschirm“.</dd>
            <dt>Android</dt><dd>In Chrome öffnen → Menü → „App installieren“.</dd>
          </dl>
          <p class="muted small" style={{ margin: 'var(--space-3) 0 0' }}>Nach dem ersten Öffnen funktioniert die App auch ohne Internet. Installiert schützt der Browser die lokalen Daten besser.</p>
        </div>
      </section>

      <section class="section" aria-labelledby="about">
        <h2 class="h2" id="about">Über die App</h2>
        <div class="card" style={{ marginTop: 'var(--space-3)' }}>
          <Notice tone="info"><p>Unabhängiger, inoffizieller Trainingsplaner – keine App des Veranstalters HYROX. Kein Medizinprodukt: keine Diagnose, keine Therapieverordnung.</p></Notice>
          <ul class="plain-list">
            <li>Gamification ohne Druck: keine Serien, keine Strafen für Ruhetage oder Krankheit.</li>
            <li>Körperkarte: Body Muscles (Ivan Vulović, Apache-2.0); Übungsfotos: Free Exercise DB (gemeinfrei).</li>
            <li>Design und Technik basieren auf FORM.</li>
          </ul>
        </div>
      </section>

      <a class="btn btn-secondary btn-block" style={{ marginTop: 'var(--space-5)' }} href={href({ name: 'data' })}><Icon name="data" size={18} />Daten & Backup</a>
    </main>
  );
}
