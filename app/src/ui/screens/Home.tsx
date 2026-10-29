import { useState } from 'preact/hooks';
import { addDays, agenda, entryKind, loadWarnings, upcoming, weekStart, WEEKDAYS, type AgendaEntry, type DayEntry } from '../../domain/calendar';
import { formatDate, parseDate, today } from '../../domain/dates';
import { count } from '../../domain/format';
import { levelOf, milestones, xp } from '../../domain/gamification';
import { daysUntil, planPosition, positionLabel } from '../../domain/phases';
import { KIND_LABELS } from '../../domain/templates';
import { kneeOf } from '../../state/knee';
import { activeSession, dismissError, useAppState } from '../../state/store';
import { startFromOccurrence } from '../../state/workout';
import { KindIcon, LightDot, Notice, ProgressBar, SessionRow } from '../components';
import { Icon } from '../icons';
import { href } from '../router';
import { FootballSheet, KneeSheet } from '../sheets';
import { ElapsedTime } from '../workout-parts';

function slotLetter(e: AgendaEntry): string {
  return e.plan.slot && e.plan.slot !== 'F' ? `Einheit ${e.plan.slot}` : KIND_LABELS[e.plan.kind];
}

function WeekStrip({ days, start, now }: { days: Map<string, DayEntry[]>; start: string; now: string }) {
  return (
    <div class="week-strip" role="group" aria-label="Diese Woche">
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(start, i);
        const list = days.get(d) ?? [];
        const done = list.some((e) => (e.kind === 'session' ? e.session.status === 'completed' : e.status === 'done'));
        const planned = list.find((e) => e.kind === 'occurrence' && e.status !== 'skipped');
        const kind = planned ? entryKind(planned) : done ? entryKind(list[0]!) : null;
        const label = `${WEEKDAYS[parseDate(d).getDay()]}: ${list.length ? list.map((e) => (e.kind === 'occurrence' ? e.plan.title : e.session.title)).join(', ') : 'Regeneration'}${done ? ', erledigt' : ''}`;
        return (
          <a key={d} href={href({ name: 'calendar', month: d.slice(0, 7) })} class={`wd${d === now ? ' wd-today' : ''}${done ? ' wd-done' : ''}${kind ? ` wd-${kind}` : ''}`} aria-label={label}>
            <small>{formatDate(d, { weekday: 'narrow' })}</small>
            <span class="wd-mark">{done ? <Icon name="check" size={14} /> : kind === 'football' ? <Icon name="football" size={14} /> : kind ? <i /> : null}</span>
          </a>
        );
      })}
    </div>
  );
}

export function Home() {
  const state = useAppState();
  const { data, migration, error, persist } = state;
  const [kneeOpen, setKneeOpen] = useState(false);
  const [football, setFootball] = useState<AgendaEntry | null>(null);
  const now = today();
  const knee = kneeOf(state);
  const active = activeSession(state);
  const imported = migration?.status === 'imported' ? migration.state : null;
  const position = planPosition(data.settings, now);
  const start = weekStart(now);
  const week = agenda(data.plans, data.sessions, start, addDays(start, 6), now);
  const warnings = loadWarnings(week, start, addDays(start, 6));
  const todays = (week.get(now) ?? []).filter((e): e is AgendaEntry => e.kind === 'occurrence' && e.status !== 'skipped');
  const todayTraining = todays.find((e) => e.plan.kind !== 'football' && e.status !== 'done');
  const todayFootball = todays.find((e) => e.plan.kind === 'football' && e.status !== 'done');
  const next = upcoming(data.plans, data.sessions, addDays(now, 1), 3);
  const recent = data.sessions.filter((s) => s.status === 'completed').slice(0, 3);
  const weekUnits = [...week.values()].flat().filter((e) => e.kind === 'occurrence' && e.plan.slot && e.plan.slot !== 'F');
  const weekDone = weekUnits.filter((e) => e.kind === 'occurrence' && e.status === 'done').length;
  const points = xp(data.sessions, data.knee);
  const lvl = levelOf(points.total);
  const nextMilestone = milestones(data.sessions, data.knee, data.settings, position).find((m) => m.current < m.goal);
  const days = daysUntil(data.settings.raceDate, now);
  const template = todayTraining ? data.templates.find((t) => t.id === todayTraining.plan.templateId) : undefined;
  const hint = position.kind === 'week' && todayTraining?.plan.slot && todayTraining.plan.slot !== 'F' ? position.phase.hints[todayTraining.plan.slot] : null;

  return (
    <main class="screen">
      <header class="page-head">
        <div>
          <p class="eyebrow">{formatDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 class="title brand">Hyrox<i>.</i></h1>
          <p class="muted small brand-sub">Trainer{data.settings.name ? ` · ${data.settings.name}` : ''}</p>
        </div>
        <div class="head-actions">
          <a class="icon-btn" href={href({ name: 'data' })} aria-label="Daten & Backup"><Icon name="data" size={20} /></a>
          <a class="icon-btn" href={href({ name: 'settings' })} aria-label="Einstellungen"><Icon name="settings" size={20} /></a>
        </div>
      </header>

      <div class="stack">
        {error && (
          <Notice tone="error" title="Fehler">
            <p>{error}</p>
            <button class="btn btn-ghost" onClick={dismissError}>Ausblenden</button>
          </Notice>
        )}
        {imported && (
          <Notice tone="info" title={migration?.status === 'imported' && migration.firstImport ? 'Deine Daten sind übernommen' : 'Neue Einträge übernommen'} icon="check">
            <p>
              {count(imported.report.completedSessions, 'abgeschlossenes Training', 'abgeschlossene Trainings')}, {count(imported.report.draftSessions, 'nicht abgeschlossener Eintrag', 'nicht abgeschlossene Einträge')} und {count(imported.report.kneeLogs, 'Knie-Check', 'Knie-Checks')} aus der bisherigen Version gelesen. Die alten Daten bleiben unverändert gespeichert.
            </p>
          </Notice>
        )}
        {persist === 'not-persisted' && data.sessions.length > 0 && (
          <Notice tone="warn" title="Speicher nicht dauerhaft geschützt">
            <p>Der Browser kann lokale Daten bei Speichermangel löschen. Installiere die App auf dem Home-Bildschirm und sichere regelmäßig ein Backup.</p>
          </Notice>
        )}

        {active ? (
          <a class="card-hero hero-link" href={href({ name: 'workout' })}>
            <p class="eyebrow"><span class="live-dot" aria-hidden="true" /> {active.reopened ? 'Korrektur offen' : 'Training läuft'}</p>
            <h2 class="h2">{active.title}</h2>
            <p class="muted">{count(active.exercises.length, 'Übung', 'Übungen')}{!active.reopened && <> · <ElapsedTime since={active.startedAt} /></>}</p>
            <span class="btn btn-primary btn-block btn-lg" style={{ marginTop: 'var(--space-4)' }}>Fortsetzen<Icon name="chevron" size={18} /></span>
          </a>
        ) : todayTraining ? (
          <section class="card-hero" aria-labelledby="today">
            <div class="hero-top">
              <p class="eyebrow">Heute · {slotLetter(todayTraining)}</p>
              <KindIcon kind={todayTraining.plan.kind} />
            </div>
            <h2 class="h2 hero-title" id="today">{todayTraining.plan.title}</h2>
            <p class="muted">{template ? `${count(template.exercises.length, 'Übung', 'Übungen')} · ca. ${template.minutes} Min.` : KIND_LABELS[todayTraining.plan.kind]}</p>
            {hint && <p class="hero-hint"><Icon name="target" size={16} />{hint}</p>}
            {knee.light === 'red' && <p class="hero-hint hero-hint-warn"><Icon name="alert" size={16} />Knie-Ampel rot: kniebelastende Übungen heute ersetzen.</p>}
            <button class="btn btn-primary btn-block btn-lg" style={{ marginTop: 'var(--space-4)' }} onClick={() => startFromOccurrence(todayTraining)}>
              <Icon name="play" size={18} />{todayTraining.status === 'started' ? 'Training fortsetzen' : 'Training starten'}
            </button>
            <a class="btn btn-ghost btn-block" href={href({ name: 'training' })}>Lieber etwas anderes trainieren</a>
          </section>
        ) : todayFootball ? (
          <section class="card-hero" aria-labelledby="today">
            <div class="hero-top"><p class="eyebrow">Heute</p><KindIcon kind="football" /></div>
            <h2 class="h2 hero-title" id="today">Fußball</h2>
            <p class="muted">{knee.light === 'red' ? 'Knie-Ampel rot: heute besser pausieren und das Knie schonen.' : 'Fußball ist eine intensive Belastung. Trag danach ein, wie es dem Knie geht.'}</p>
            <button class="btn btn-primary btn-block btn-lg" style={{ marginTop: 'var(--space-4)' }} onClick={() => setFootball(todayFootball)}>
              <Icon name="football" size={18} />Fußball eintragen
            </button>
            <a class="btn btn-ghost btn-block" href={href({ name: 'calendar' })}>Verschieben oder auslassen</a>
          </section>
        ) : (
          <section class="card-hero" aria-labelledby="today">
            <div class="hero-top"><p class="eyebrow">Heute</p></div>
            <h2 class="h2 hero-title" id="today">Regeneration</h2>
            <p class="muted">{next[0] ? `Als Nächstes: ${next[0].plan.title} am ${WEEKDAYS[parseDate(next[0].date).getDay()]}.` : 'Nichts geplant.'} Erholung gehört zum Plan – Ruhetage kosten keine Punkte.</p>
            <a class="btn btn-secondary btn-block" style={{ marginTop: 'var(--space-4)' }} href={href({ name: 'training' })}><Icon name="dumbbell" size={18} />Trotzdem trainieren</a>
          </section>
        )}
      </div>

      <section class="card knee-card" aria-labelledby="knee" style={{ marginTop: 'var(--space-3)' }}>
        <div class="knee-head">
          <div>
            <p class="eyebrow" id="knee">Knie-Ampel</p>
            <LightDot light={knee.light} />
          </div>
          <button class="btn btn-secondary btn-sm" onClick={() => setKneeOpen(true)}><Icon name="pulse" size={16} />Knie-Check</button>
        </div>
        <p class="muted small" style={{ margin: 'var(--space-2) 0 0' }}>{knee.reason}{knee.stale ? ' Der Wert ist älter als eine Woche.' : ''}</p>
        <p class="small" style={{ margin: 'var(--space-1) 0 0' }}>{knee.advice}</p>
        {knee.seeProfessional && (
          <p class="small warn-text" style={{ margin: 'var(--space-2) 0 0' }}>Empfehlung: Beschwerden sportmedizinisch oder physiotherapeutisch abklären lassen. Die App stellt keine Diagnose.</p>
        )}
        <a class="btn btn-ghost btn-sm knee-link" href={href({ name: 'knee' })}>Verlauf ansehen<Icon name="chevron" size={16} /></a>
      </section>

      <section class="section" aria-labelledby="week">
        <div class="section-head">
          <h2 class="h2" id="week">Diese Woche</h2>
          <span class="muted small tabular">{weekDone}/{weekUnits.length} Einheiten</span>
        </div>
        <WeekStrip days={week} start={start} now={now} />
        {warnings.map((w) => <div key={w.dates[0]} style={{ marginTop: 'var(--space-2)' }}><Notice tone="warn"><p>{w.text}</p></Notice></div>)}
      </section>

      <section class="section" aria-labelledby="goal">
        <div class="section-head"><h2 class="h2" id="goal">Weg nach {data.settings.raceName.replace(/^HYROX\s*/i, '') || 'Wien'}</h2></div>
        <div class="stats">
          <div class="stat stat-accent"><b>{Math.max(0, days)}</b><span>Tage bis zum Rennen</span></div>
          <div class="stat"><b>{position.kind === 'week' ? position.week : position.kind === 'raceweek' ? '17' : '–'}</b><span>{position.kind === 'week' ? `Woche von 16 · ${position.phase.name}` : positionLabel(position)}</span></div>
          <div class="stat"><b>{lvl.level}</b><span>Level · {lvl.name}</span></div>
        </div>
        <a class="card card-link" href={href({ name: 'progress' })} style={{ marginTop: 'var(--space-2)' }}>
          <div class="row-main">
            <b>{points.total} XP{lvl.span ? ` · noch ${lvl.span - lvl.into} bis Level ${lvl.level + 1}` : ''}</b>
            {lvl.span && <ProgressBar value={lvl.into} max={lvl.span} label="Fortschritt bis zum nächsten Level" />}
            {nextMilestone && <small style={{ marginTop: 'var(--space-2)' }}>Nächster Meilenstein: {nextMilestone.title} ({nextMilestone.current}/{nextMilestone.goal})</small>}
          </div>
          <Icon name="chevron" size={18} class="chevron" />
        </a>
      </section>

      <section class="section" aria-labelledby="next">
        <div class="section-head">
          <h2 class="h2" id="next">Als Nächstes</h2>
          <a class="btn btn-ghost" href={href({ name: 'calendar' })}>Kalender</a>
        </div>
        {next.length ? (
          <div class="list">
            {next.map((e) => (
              <a class="row" key={`${e.plan.id}|${e.original}`} href={href({ name: 'calendar', month: e.date.slice(0, 7) })}>
                <div class="row-date" aria-hidden="true"><b>{Number(e.date.slice(8))}</b><small>{formatDate(e.date, { weekday: 'short' }).replace('.', '')}</small></div>
                <KindIcon kind={e.plan.kind} />
                <div class="row-main"><b>{e.plan.title}</b><small>{slotLetter(e)}</small></div>
                <Icon name="chevron" size={18} class="chevron" />
              </a>
            ))}
          </div>
        ) : <p class="muted small">Nichts geplant. Den Wochenplan stellst du in den Einstellungen ein.</p>}
      </section>

      <section class="section" aria-labelledby="recent">
        <div class="section-head">
          <h2 class="h2" id="recent">Zuletzt trainiert</h2>
          {recent.length > 0 && <a class="btn btn-ghost" href={href({ name: 'history' })}>Alle</a>}
        </div>
        {recent.length ? <div class="list">{recent.map((s) => <SessionRow key={s.id} session={s} />)}</div> : (
          <div class="empty">
            <h3 class="h3">Noch keine abgeschlossenen Einheiten</h3>
            <p class="muted small">Sobald du ein Training abschließt, erscheint es hier. Geplante Termine zählen nicht als Training.</p>
          </div>
        )}
      </section>

      {kneeOpen && <KneeSheet onClose={() => setKneeOpen(false)} />}
      {football && <FootballSheet onClose={() => setFootball(null)} date={football.date} plannedRef={{ planId: football.plan.id, occurrence: football.original }} />}
    </main>
  );
}
