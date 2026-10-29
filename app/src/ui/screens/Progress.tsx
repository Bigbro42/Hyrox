import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { makeLookup } from '../../domain/catalog';
import { formatDate, today } from '../../domain/dates';
import { clock, fmtNum, pace } from '../../domain/format';
import { levelOf, LEVELS, milestones, xp } from '../../domain/gamification';
import { exerciseHistory, personalBests } from '../../domain/history';
import { RACE_STATIONS } from '../../domain/hyrox';
import { kneePoints } from '../../domain/knee';
import { planPosition } from '../../domain/phases';
import { completed, exerciseProgress, FATIGUE, raceEstimate, runPoints, stationBests, weekly } from '../../domain/progress';
import { useAppState } from '../../state/store';
import { BarChart, LineChart, type Datum } from '../charts';
import { ProgressBar } from '../components';
import { Icon } from '../icons';
import { href } from '../router';

const STRENGTH_LIFTS = ['strength-bench-press', 'strength-overhead-press', 'strength-deadlift', 'strength-rdl'];

export function Progress() {
  const { data } = useAppState();
  const now = today();
  const [lift, setLift] = useState(STRENGTH_LIFTS[0]!);
  const lookup = makeLookup(data.customExercises);
  const done = completed(data.sessions);
  const points = xp(data.sessions, data.knee);
  const lvl = levelOf(points.total);
  const weeks = weekly(data.sessions, now, 12);
  const weekData: Datum[] = weeks.map((w) => ({ key: w.start, label: formatDate(w.start, { day: 'numeric', month: 'numeric' }), value: w.sessions, detail: `Woche ab ${formatDate(w.start, { day: 'numeric', month: 'short' })}: ${w.sessions} ${w.sessions === 1 ? 'Einheit' : 'Einheiten'}${w.minutes ? `, ${w.minutes} Min.` : ''}` }));
  const knee = kneePoints(data.sessions, data.knee).slice(-30);
  const kneeData: Datum[] = knee.map((p, i) => ({ key: `${p.at}-${i}`, label: formatDate(p.date, { day: 'numeric', month: 'numeric' }), value: p.pain, detail: `${formatDate(p.date, { day: 'numeric', month: 'short' })}: ${p.pain}/10` }));
  const runs = runPoints(data.sessions);
  const runData: Datum[] = runs.map((r, i) => ({ key: `${r.date}-${i}`, label: formatDate(r.date, { day: 'numeric', month: 'numeric' }), value: Math.round(r.pace) / 60, detail: `${formatDate(r.date, { day: 'numeric', month: 'short' })}: ${fmtNum(r.meters)} m · ${pace(r.meters, r.timeSec)}` }));
  const liftHistory = exerciseHistory(data.sessions, lift);
  const liftData: Datum[] = exerciseProgress(liftHistory, 'reps').map((p, i) => ({ key: `${p.date}-${i}`, label: formatDate(p.date, { day: 'numeric', month: 'numeric' }), value: p.value, detail: `${formatDate(p.date, { day: 'numeric', month: 'short' })}: ≈ ${fmtNum(p.value)} kg (geschätztes 1RM)` }));
  const stations = stationBests(data.sessions);
  const estimate = raceEstimate(data.sessions, data.settings);
  const goals = milestones(data.sessions, data.knee, data.settings, planPosition(data.settings, now));
  const records = STRENGTH_LIFTS.map((id) => ({ id, def: lookup(id), pb: personalBests(exerciseHistory(data.sessions, id), 'reps') })).filter((r) => r.pb.heaviest);

  return (
    <main class="screen">
      <header class="page-head"><div><p class="eyebrow">Jeder Schritt zählt</p><h1 class="title">Fortschritt</h1></div></header>

      <div class="stats">
        <div class="stat"><b>{done.filter((s) => s.kind !== 'football').length}</b><span>Einheiten</span></div>
        <div class="stat"><b>{done.filter((s) => s.kind === 'physio').length}</b><span>Physio</span></div>
        <div class="stat stat-accent"><b>{lvl.level}</b><span>Level · {points.total} XP</span></div>
      </div>

      <section class="card level-card" style={{ marginTop: 'var(--space-2)' }} aria-label="Level">
        <div class="knee-head"><b>Level {lvl.level}: {lvl.name}</b><span class="muted small tabular">{lvl.span ? `${lvl.into}/${lvl.span} XP` : 'Höchstes Level'}</span></div>
        {lvl.span && <ProgressBar value={lvl.into} max={lvl.span} label="Fortschritt bis zum nächsten Level" />}
        <p class="muted small" style={{ margin: 'var(--space-2) 0 0' }}>XP gibt es für jede abgeschlossene Einheit (Physio 40, Kraft und HYROX 60, Fußball 20) und 5 XP pro Tag mit Kniewert. Ruhetage kosten nichts, es gibt keine Serien, die reißen können. Nächstes Level: {LEVELS[lvl.level]?.name ?? '–'}.</p>
      </section>

      <section class="section" aria-labelledby="weeks">
        <div class="section-head"><h2 class="h2" id="weeks">Trainingshäufigkeit</h2><span class="muted small">12 Wochen</span></div>
        <div class="card"><BarChart data={weekData} title="Einheiten pro Woche" valueLabel="Einheiten" summary={`${weeks.reduce((n, w) => n + w.sessions, 0)} Einheiten in 12 Wochen`} /></div>
      </section>

      <section class="section" aria-labelledby="knee">
        <div class="section-head"><h2 class="h2" id="knee">Knie-Beschwerden</h2><a class="btn btn-ghost" href={href({ name: 'knee' })}>Details</a></div>
        <div class="card"><LineChart data={kneeData} title="Knieschmerz" valueLabel="Schmerz (0–10)" summary={knee.length ? `Letzter Wert ${knee.at(-1)!.pain}/10` : ''} unit="Schmerz 0–10" /></div>
      </section>

      <section class="section" aria-labelledby="race">
        <div class="section-head"><h2 class="h2" id="race">Zielzeit-Schätzung</h2><span class="muted small">Ziel {data.settings.targetTime} h</span></div>
        <div class="card">
          {estimate.ready ? (
            <>
              <p class="estimate tabular">{clock(estimate.low)} – {clock(estimate.high)}</p>
              <p class="muted small" style={{ margin: 'var(--space-1) 0 var(--space-3)' }}>Schätzung aus deinen Trainingsdaten, keine Prognose. Untere Grenze: linear hochgerechnet; obere: +{Math.round((FATIGUE - 1) * 100)} % für Ermüdung über das ganze Rennen. Annahme: dein Partner ist an jeder Station gleich schnell.</p>
              <details class="chart-table">
                <summary>So wird gerechnet</summary>
                <table class="sets"><tbody>{estimate.parts.map((p) => <tr key={p.label}><td>{p.label}<br /><small class="muted">{p.basis}</small></td><td>{clock(p.seconds)}</td></tr>)}</tbody></table>
              </details>
            </>
          ) : (
            <>
              <p style={{ margin: 0 }}>Für eine Schätzung fehlen noch Daten mit Distanz und Zeit:</p>
              <ul class="plain-list">{estimate.missing.map((m) => <li key={m}>{m}</li>)}</ul>
              <p class="muted small" style={{ margin: 'var(--space-2) 0 0' }}>Gesperrte Stationen (z. B. Burpee Broad Jumps) bleiben offen, bis sie freigegeben sind – die App rechnet nichts hinzu, was du nicht trainiert hast.</p>
            </>
          )}
        </div>
      </section>

      <section class="section" aria-labelledby="stations">
        <div class="section-head"><h2 class="h2" id="stations">HYROX-Stationen</h2></div>
        <div class="list">
          {stations.map((s) => (
            <a key={s.station} class="row" href={href({ name: 'exerciseInfo', id: s.exerciseId })}>
              <div class="row-main">
                <b>{s.name}</b>
                <small>{s.best ? `Bestwert ${fmtNum(s.best.value)} ${RACE_STATIONS[s.station].unit} in ${clock(s.best.timeSec)} · ${formatDate(s.best.date, { day: 'numeric', month: 'short' })}` : s.sessions ? 'Trainiert, aber ohne Zeit erfasst' : 'Noch nicht trainiert'}</small>
              </div>
              {s.best && <span class="chip chip-done">≈ {clock((s.best.timeSec / s.best.value) * RACE_STATIONS[s.station].amount)}</span>}
              <Icon name="chevron" size={18} class="chevron" />
            </a>
          ))}
        </div>
        <p class="muted small" style={{ margin: 'var(--space-2) 0 0' }}>Die Zeit rechts ist dein Bestwert linear auf die Renndistanz hochgerechnet.</p>
      </section>

      <section class="section" aria-labelledby="run">
        <div class="section-head"><h2 class="h2" id="run">Lauftempo</h2></div>
        <div class="card"><LineChart data={runData} title="Tempo in Minuten pro Kilometer" valueLabel="Min./km" summary={runs.length ? `Letzter Lauf: ${pace(runs.at(-1)!.meters, runs.at(-1)!.timeSec)}` : ''} unit="Minuten pro Kilometer (niedriger ist schneller)" /></div>
      </section>

      <section class="section" aria-labelledby="strength">
        <div class="section-head"><h2 class="h2" id="strength">Kraft halten</h2></div>
        <div class="chips" role="group" aria-label="Übung">
          {STRENGTH_LIFTS.map((id) => <button key={id} class="chip-btn" aria-pressed={lift === id} onClick={() => setLift(id)}>{lookup(id)?.name}</button>)}
        </div>
        <div class="card" style={{ marginTop: 'var(--space-2)' }}><LineChart data={liftData} title="Geschätztes 1RM" valueLabel="kg" summary={liftData.length ? `Zuletzt ≈ ${fmtNum(liftData.at(-1)!.value)} kg` : ''} unit="Kilogramm" /></div>
        {records.length > 0 && (
          <div class="card" style={{ marginTop: 'var(--space-2)' }}>
            <p class="eyebrow"><Icon name="trophy" size={14} /> Persönliche Rekorde</p>
            <dl class="kv">{records.map((r) => <Fragment key={r.id}><dt>{r.def?.name}</dt><dd>{fmtNum(r.pb.heaviest!.weightKg)} kg × {fmtNum(r.pb.heaviest!.value)}</dd></Fragment>)}</dl>
          </div>
        )}
      </section>

      <section class="section" aria-labelledby="goals">
        <div class="section-head"><h2 class="h2" id="goals">Meilensteine</h2><span class="muted small">{goals.filter((g) => g.current >= g.goal).length}/{goals.length}</span></div>
        <div class="list">
          {goals.map((g) => (
            <div key={g.id} class={`row milestone${g.current >= g.goal ? ' milestone-done' : ''}`}>
              <span class="ms-icon" aria-hidden="true"><Icon name={g.current >= g.goal ? 'star' : 'target'} size={20} /></span>
              <div class="row-main">
                <b>{g.title}</b>
                <small>{g.description}</small>
                {g.current < g.goal && <ProgressBar value={g.current} max={g.goal} label={`${g.current} von ${g.goal}`} />}
              </div>
              <span class="muted small tabular">{Math.min(g.current, g.goal)}/{g.goal}</span>
            </div>
          ))}
        </div>
      </section>

      <a class="card card-link" href={href({ name: 'history' })} style={{ marginTop: 'var(--space-5)' }}>
        <span class="icon-btn" aria-hidden="true"><Icon name="history" size={20} /></span>
        <span class="row-main"><b>Trainingshistorie</b><small>{data.sessions.filter((s) => s.status !== 'active').length} Einträge</small></span>
        <Icon name="chevron" size={18} class="chevron" />
      </a>
    </main>
  );
}
