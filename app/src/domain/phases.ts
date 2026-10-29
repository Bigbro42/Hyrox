/**
 * 16-week periodisation towards the race. The calendar only says which phase it is; whether a
 * step up is sensible is decided by knee status and logged training (see knee.ts, running.ts).
 */
import { parseDate } from './dates';
import type { IsoDate, Settings } from './types';

export interface Phase {
  id: 1 | 2 | 3 | 4 | 5;
  name: string;
  weeks: [number, number];
  focus: string[];
  /** Hint per unit while the phase lasts. */
  hints: { A: string; B: string; C: string };
}

export const PLAN_WEEKS = 16;
/** Week 8 reduces volume so the body can absorb the first two phases. */
export const DELOAD_WEEKS = [8];

export const PHASES: Phase[] = [
  {
    id: 1,
    name: 'Knie & Grundlage',
    weeks: [1, 4],
    focus: ['Knie-Management und Schmerz-Monitoring', 'Grundlagen und Technik der Stationen', 'Verträgliche Ausdauer: Rad, Rudern, SkiErg, Gehen mit Steigung', 'Kontrolliertes Krafttraining mit 2–3 Wdh. Reserve'],
    hints: {
      A: 'Basis-Übungen sauber und schmerzarm; Schmerz höchstens 3/10.',
      B: 'Kraft halten, nicht steigern. Ausdauer über Rad oder Rudern.',
      C: 'Technik der kniefreundlichen Stationen: SkiErg, RowErg, Farmers Carry, Sled Pull.',
    },
  },
  {
    id: 2,
    name: 'Ausdaueraufbau',
    weeks: [5, 8],
    focus: ['Grundlagenausdauer ausbauen', 'Laufleiter nur bei grüner Knie-Ampel weiter', 'Erste anspruchsvollere HYROX-Übungen nach Verträglichkeit', 'Woche 8: Entlastungswoche'],
    hints: {
      A: 'Progressionen nur, wenn die Basis seit zwei Wochen beschwerdearm ist.',
      B: 'Ausdauerblock verlängern (z. B. Rad-Intervalle oder Laufleiter).',
      C: 'Intervalle verlängern; Wall Balls nur zur Box, wenn das Knie grün ist.',
    },
  },
  {
    id: 3,
    name: 'HYROX-Kombinationen',
    weeks: [9, 12],
    focus: ['Laufen bzw. Ersatzausdauer direkt nach Stationen', 'Gemeinsames Training mit dem Doubles-Partner', 'Wechsel und Stationsaufteilung üben'],
    hints: {
      A: 'Physio-Einheit kürzer halten, aber nicht auslassen.',
      B: 'Kraft halten, Ausdauerblock als Kombi mit einer Station.',
      C: 'Stationen mit kurzen Läufen (200–500 m) oder Rad koppeln – nur bei grüner Ampel.',
    },
  },
  {
    id: 4,
    name: 'Rennvorbereitung',
    weeks: [13, 14],
    focus: ['Wettkampfnahe Einheiten', 'Mixed-Doubles-Simulationen', 'Strategische Stationsverteilung festlegen'],
    hints: {
      A: 'Kurz und regelmäßig – Knie stabil halten.',
      B: 'Kraft auf Erhaltungsniveau.',
      C: 'Teilsimulation (z. B. 4 Stationen mit Läufen) mit eurer geplanten Aufteilung.',
    },
  },
  {
    id: 5,
    name: 'Tapering',
    weeks: [15, 16],
    focus: ['Umfang um 30–50 % reduzieren', 'Kurze, frische Reize statt Ermüdung', 'Erholung, Schlaf und Rennlogistik'],
    hints: {
      A: 'Locker, nur Basis.',
      B: 'Wenige Sätze, gewohnte Gewichte.',
      C: 'Kurze Technik-Einheit, keine neue Belastung.',
    },
  },
];

function weeksBetween(a: IsoDate, b: IsoDate): number {
  return Math.floor((parseDate(b).getTime() - parseDate(a).getTime()) / (7 * 86_400_000));
}

export function daysUntil(date: IsoDate, today: IsoDate): number {
  return Math.round((parseDate(date).getTime() - parseDate(today).getTime()) / 86_400_000);
}

export type PlanPosition =
  | { kind: 'before'; startsIn: number }
  | { kind: 'week'; week: number; phase: Phase; deload: boolean }
  | { kind: 'raceweek' }
  | { kind: 'after' };

/** Where the athlete is in the plan today. Weeks after week 16 up to the race are the race week. */
export function planPosition(settings: Pick<Settings, 'planStart' | 'raceDate'>, today: IsoDate): PlanPosition {
  if (today > settings.raceDate) return { kind: 'after' };
  if (today < settings.planStart) return { kind: 'before', startsIn: daysUntil(settings.planStart, today) };
  const week = weeksBetween(settings.planStart, today) + 1;
  if (week > PLAN_WEEKS) return { kind: 'raceweek' };
  return { kind: 'week', week, phase: phaseOf(week), deload: DELOAD_WEEKS.includes(week) };
}

export function phaseOf(week: number): Phase {
  return PHASES.find((p) => week >= p.weeks[0] && week <= p.weeks[1]) ?? PHASES[PHASES.length - 1]!;
}

export function positionLabel(p: PlanPosition): string {
  switch (p.kind) {
    case 'before': return `Plan startet in ${p.startsIn} ${p.startsIn === 1 ? 'Tag' : 'Tagen'}`;
    case 'week': return `Woche ${p.week}/${PLAN_WEEKS} · ${p.phase.name}${p.deload ? ' · Entlastung' : ''}`;
    case 'raceweek': return 'Rennwoche';
    case 'after': return 'Nach dem Rennen';
  }
}
