import { useState } from 'preact/hooks';
import {
  addDays, agenda, createPlan, entryKind, loadWarnings, monthGrid, moveOccurrence, RACE_PLAN_ID, restoreOccurrence,
  shiftMonth, skipOccurrence, weekStart, WEEKDAYS, type AgendaEntry, type DayEntry,
} from '../../domain/calendar';
import { formatDate, parseDate, today } from '../../domain/dates';
import { TEMPLATE_IDS } from '../../domain/templates';
import { savePlans, useAppState } from '../../state/store';
import { startFromOccurrence } from '../../state/workout';
import { KindIcon, monthLabel, Notice, SessionRow, Sheet, StatusChip } from '../components';
import { Icon } from '../icons';
import { href, navigate } from '../router';
import { FootballSheet } from '../sheets';

const STATUS_TEXT: Record<AgendaEntry['status'], string> = { planned: 'Geplant', done: 'Erledigt', started: 'Begonnen', open: 'Nicht eingetragen', skipped: 'Ausgelassen' };

function MoveSheet({ entry, onClose }: { entry: AgendaEntry; onClose: () => void }) {
  const [to, setTo] = useState(entry.date);
  const monday = weekStart(entry.date);
  const quick = entry.plan.kind === 'football'
    ? [{ label: 'Donnerstag', date: addDays(monday, 3) }, { label: 'Sonntag', date: addDays(monday, 6) }]
    : [{ label: 'Einen Tag früher', date: addDays(entry.date, -1) }, { label: 'Einen Tag später', date: addDays(entry.date, 1) }];
  const move = (date: string) => {
    void savePlans([moveOccurrence(entry.plan, entry.original, date)]);
    onClose();
  };
  return (
    <Sheet title={`${entry.plan.title} verschieben`} onClose={onClose}>
      <p>Nur dieser Termin wird verschoben, der Wochenplan bleibt gleich.</p>
      <div class="btn-row">
        {quick.filter((q) => q.date !== entry.date).map((q) => <button key={q.date} class="btn btn-secondary" onClick={() => move(q.date)}>{q.label} · {formatDate(q.date, { day: 'numeric', month: 'short' })}</button>)}
      </div>
      <label class="field">
        <span>Anderes Datum</span>
        <input class="input" type="date" value={to} onInput={(e) => setTo((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <div class="stack" style={{ marginTop: 'var(--space-4)' }}>
        <button class="btn btn-primary btn-block" disabled={!to || to === entry.date} onClick={() => move(to)}>Verschieben</button>
      </div>
    </Sheet>
  );
}

function AddSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { data } = useAppState();
  const add = (kind: 'A' | 'B' | 'C' | 'F') => {
    const templateId = kind === 'F' ? null : TEMPLATE_IDS[kind];
    const t = data.templates.find((x) => x.id === templateId);
    void savePlans([createPlan({ title: kind === 'F' ? 'Fußball' : t?.name ?? 'Training', kind: kind === 'F' ? 'football' : t?.kind ?? 'free', templateId, startsOn: date, time: null })]);
    onClose();
  };
  return (
    <Sheet title={`Eintrag am ${formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}`} onClose={onClose}>
      <p>Ein einmaliger Termin zusätzlich zum Wochenplan.</p>
      <div class="list">
        {(['A', 'B', 'C'] as const).map((k) => {
          const t = data.templates.find((x) => x.id === TEMPLATE_IDS[k]);
          return <button key={k} class="row" onClick={() => add(k)}>{t && <KindIcon kind={t.kind} />}<div class="row-main"><b>Einheit {k}</b><small>{t?.name}</small></div><Icon name="plus" size={18} class="chevron" /></button>;
        })}
        <button class="row" onClick={() => add('F')}><KindIcon kind="football" /><div class="row-main"><b>Fußball</b><small>Spiel oder Training</small></div><Icon name="plus" size={18} class="chevron" /></button>
      </div>
    </Sheet>
  );
}

function marksOf(list: DayEntry[]) {
  const marks: string[] = [];
  for (const e of list) {
    if (e.kind === 'session') marks.push(e.session.status === 'completed' ? 'done' : 'draft');
    else if (e.plan.id === RACE_PLAN_ID) marks.push('race');
    else if (e.status === 'done') marks.push('done');
    else if (e.status === 'skipped') continue;
    else if (e.plan.kind === 'football') marks.push(e.status === 'open' ? 'missed' : 'football');
    else marks.push(e.status === 'open' ? 'missed' : e.status === 'started' ? 'draft' : 'planned');
  }
  return marks.slice(0, 3);
}

export function Calendar({ month }: { month?: string }) {
  const { data } = useAppState();
  const now = today();
  const shown = month ?? now.slice(0, 7);
  const [view, setView] = useState<'month' | 'week'>('month');
  const [selected, setSelected] = useState(shown === now.slice(0, 7) ? now : `${shown}-01`);
  const [moving, setMoving] = useState<AgendaEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [football, setFootball] = useState<AgendaEntry | null>(null);
  const grid = monthGrid(shown);
  const days = agenda(data.plans, data.sessions, grid[0]!, grid[41]!, now, true);
  const monday = weekStart(selected);
  const weekDays = agenda(data.plans, data.sessions, monday, addDays(monday, 6), now, true);
  const warnings = loadWarnings(weekDays, monday, addDays(monday, 6));
  const goMonth = (m: string) => {
    setSelected(m === now.slice(0, 7) ? now : `${m}-01`);
    navigate({ name: 'calendar', month: m }, true);
  };
  const goWeek = (delta: number) => {
    const d = addDays(selected, delta * 7);
    setSelected(d);
    if (d.slice(0, 7) !== shown) navigate({ name: 'calendar', month: d.slice(0, 7) }, true);
  };

  const entryRow = (e: DayEntry) => {
    if (e.kind === 'session') return <SessionRow key={e.session.id} session={e.session} />;
    const canStart = (e.status === 'planned' || e.status === 'started' || e.status === 'open') && e.date <= now;
    const isFootball = e.plan.kind === 'football';
    return (
      <div key={`${e.plan.id}|${e.original}`} class={`card occ${e.status === 'skipped' ? ' occ-skipped' : ''}`}>
        <div class="occ-head">
          <KindIcon kind={e.plan.kind} />
          <div class="row-main">
            <b>{e.plan.title}</b>
            <small>{e.plan.slot && e.plan.slot !== 'F' ? `Einheit ${e.plan.slot} · ` : ''}{STATUS_TEXT[e.status]}{e.date !== e.original ? ` · verschoben von ${formatDate(e.original, { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}</small>
          </div>
          {e.session && <StatusChip status={e.session.status} />}
        </div>
        {e.status !== 'done' && (
          <div class="btn-row" style={{ marginTop: 'var(--space-3)' }}>
            {canStart && e.status !== 'skipped' && (isFootball
              ? <button class="btn btn-primary btn-sm" onClick={() => setFootball(e)}><Icon name="football" size={16} />Eintragen</button>
              : <button class="btn btn-primary btn-sm" onClick={() => startFromOccurrence(e)}><Icon name="play" size={16} />{e.status === 'started' ? 'Fortsetzen' : 'Starten'}</button>)}
            {e.status === 'skipped'
              ? <button class="btn btn-secondary btn-sm" onClick={() => void savePlans([restoreOccurrence(e.plan, e.original)])}>Wiederherstellen</button>
              : !e.session && (
                <>
                  <button class="btn btn-secondary btn-sm" onClick={() => setMoving(e)}><Icon name="calendar" size={16} />Verschieben</button>
                  <button class="btn btn-secondary btn-sm" onClick={() => void savePlans([skipOccurrence(e.plan, e.original)])}>Auslassen</button>
                </>
              )}
          </div>
        )}
        {e.session?.status === 'completed' && <a class="btn btn-ghost btn-sm" href={href({ name: 'session', id: e.session.id })}>Ansehen<Icon name="chevron" size={16} /></a>}
      </div>
    );
  };

  const selectedList = days.get(selected) ?? weekDays.get(selected) ?? [];

  return (
    <main class="screen">
      <header class="page-head">
        <div><p class="eyebrow">Deine Trainingswoche</p><h1 class="title">Kalender</h1></div>
        <button class="icon-btn icon-btn-accent" aria-label="Eintrag hinzufügen" onClick={() => setAdding(true)}><Icon name="plus" size={20} /></button>
      </header>

      <div class="segmented" role="group" aria-label="Ansicht">
        <button aria-pressed={view === 'month'} onClick={() => setView('month')}>Monat</button>
        <button aria-pressed={view === 'week'} onClick={() => setView('week')}>Woche</button>
      </div>

      {view === 'month' ? (
        <section class="card" aria-label={monthLabel(`${shown}-01`)}>
          <div class="month-nav">
            <button class="icon-btn icon-btn-sm" aria-label="Vorheriger Monat" onClick={() => goMonth(shiftMonth(shown, -1))}><Icon name="back" size={18} /></button>
            <h2 class="h3">{monthLabel(`${shown}-01`)}</h2>
            <button class="icon-btn icon-btn-sm" aria-label="Nächster Monat" onClick={() => goMonth(shiftMonth(shown, 1))}><Icon name="chevron" size={18} /></button>
          </div>
          <div class="month">
            <div class="month-row month-dow" aria-hidden="true">{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => <span key={d}>{d}</span>)}</div>
            {Array.from({ length: 6 }, (_, r) => (
              <div class="month-row" key={r}>
                {grid.slice(r * 7, r * 7 + 7).map((d) => {
                  const list = days.get(d) ?? [];
                  const marks = marksOf(list);
                  return (
                    <button key={d} class={`day${d.slice(0, 7) !== shown ? ' day-out' : ''}${d === now ? ' day-today' : ''}${d === selected ? ' day-selected' : ''}`}
                      aria-pressed={d === selected} aria-label={`${formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${list.length ? `: ${list.length} ${list.length === 1 ? 'Eintrag' : 'Einträge'}` : ''}`}
                      onClick={() => setSelected(d)}>
                      <span>{parseDate(d).getDate()}</span>
                      <span class="marks">{marks.map((m, i) => <i key={i} class={`mark mark-${m}`} />)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div class="legend">
            <span><i class="mark mark-planned" />Geplant</span>
            <span><i class="mark mark-done" />Erledigt</span>
            <span><i class="mark mark-football" />Fußball</span>
            <span><i class="mark mark-race" />Rennen</span>
          </div>
        </section>
      ) : (
        <section aria-label="Woche">
          <div class="month-nav">
            <button class="icon-btn icon-btn-sm" aria-label="Vorherige Woche" onClick={() => goWeek(-1)}><Icon name="back" size={18} /></button>
            <h2 class="h3">{formatDate(monday, { day: 'numeric', month: 'short' })} – {formatDate(addDays(monday, 6), { day: 'numeric', month: 'short' })}</h2>
            <button class="icon-btn icon-btn-sm" aria-label="Nächste Woche" onClick={() => goWeek(1)}><Icon name="chevron" size={18} /></button>
          </div>
          <div class="list">
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(monday, i);
              const list = (weekDays.get(d) ?? []).filter((e) => e.kind === 'session' || e.status !== 'skipped');
              return (
                <button key={d} class={`row week-row${d === selected ? ' week-row-selected' : ''}${d === now ? ' week-row-today' : ''}`} onClick={() => setSelected(d)}>
                  <div class="row-date" aria-hidden="true"><b>{parseDate(d).getDate()}</b><small>{WEEKDAYS[parseDate(d).getDay()]!.slice(0, 2)}</small></div>
                  <div class="row-main">
                    <b>{list.length ? list.map((e) => (e.kind === 'occurrence' ? e.plan.title : e.session.title)).join(' · ') : 'Regeneration'}</b>
                    <small>{list.length ? list.map((e) => (e.kind === 'occurrence' ? STATUS_TEXT[e.status] : e.session.status === 'completed' ? 'Erledigt' : 'Nicht abgeschlossen')).join(' · ') : 'Kein Termin'}</small>
                  </div>
                  {list[0] && <KindIcon kind={entryKind(list[0])} />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {warnings.map((w) => <div key={w.dates[0]} style={{ marginTop: 'var(--space-3)' }}><Notice tone="warn" title="Belastung"><p>{w.text}</p></Notice></div>)}

      <section class="section" aria-labelledby="day">
        <div class="section-head"><h2 class="h2" id="day">{formatDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div>
        {selectedList.length ? <div class="list">{selectedList.map(entryRow)}</div> : (
          <div class="empty"><p class="muted small">Regeneration oder freie Gestaltung. Mit + kannst du einen einmaligen Termin eintragen.</p></div>
        )}
      </section>

      <a class="card card-link" href={href({ name: 'settings' })} style={{ marginTop: 'var(--space-4)' }}>
        <span class="icon-btn" aria-hidden="true"><Icon name="settings" size={20} /></span>
        <span class="row-main"><b>Wochenplan anpassen</b><small>Wochentage der Einheiten A, B, C und den Fußballtag ändern ({WEEKDAYS[data.settings.days.A]}, {WEEKDAYS[data.settings.days.B]}, {WEEKDAYS[data.settings.days.C]}{data.settings.football !== 'none' ? `, Fußball ${data.settings.football === 'thursday' ? 'Donnerstag' : 'Sonntag'}` : ''}).</small></span>
        <Icon name="chevron" size={18} class="chevron" />
      </a>

      {moving && <MoveSheet entry={moving} onClose={() => setMoving(null)} />}
      {adding && <AddSheet date={selected} onClose={() => setAdding(false)} />}
      {football && <FootballSheet onClose={() => setFootball(null)} date={football.date <= now ? football.date : now} plannedRef={{ planId: football.plan.id, occurrence: football.original }} />}
    </main>
  );
}

