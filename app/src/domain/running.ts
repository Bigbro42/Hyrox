/**
 * Walk-run ladder for a careful return to running. The app only suggests the next step; the
 * athlete decides and confirms each change. Rules (common return-to-run practice, to be agreed
 * with the physio): at most one step per week, pain while running at most 2/10 and no worse the
 * next morning.
 */
import type { KneeLight } from './knee';

export interface RunStep {
  step: number;
  title: string;
  detail: string;
  /** Total minutes including walking. */
  minutes: number;
  /** Continuous running from here on: only after an assessment of the knee. */
  continuous: boolean;
}

export const RUN_LADDER: RunStep[] = [
  { step: 1, title: '8 × (1 Min. laufen / 2 Min. gehen)', detail: 'Sehr lockeres Lauftempo, ebener Untergrund.', minutes: 24, continuous: false },
  { step: 2, title: '6 × (2 Min. laufen / 2 Min. gehen)', detail: 'Lauftempo unverändert locker.', minutes: 24, continuous: false },
  { step: 3, title: '5 × (3 Min. laufen / 1,5 Min. gehen)', detail: 'Gehpausen werden kürzer.', minutes: 23, continuous: false },
  { step: 4, title: '4 × (5 Min. laufen / 1 Min. gehen)', detail: 'Erste längere Laufblöcke.', minutes: 24, continuous: false },
  { step: 5, title: '3 × (8 Min. laufen / 1 Min. gehen)', detail: 'Auf gleichmäßiges Tempo achten.', minutes: 27, continuous: false },
  { step: 6, title: '2 × (12 Min. laufen / 1 Min. gehen)', detail: 'Fast durchgehend.', minutes: 26, continuous: false },
  { step: 7, title: '25 Min. durchgehend locker', detail: 'Erster durchgehender Lauf.', minutes: 25, continuous: true },
  { step: 8, title: '30 Min. locker (ca. 4–5 km)', detail: 'Grundlage für 8 × 1 km im Rennen.', minutes: 30, continuous: true },
  { step: 9, title: 'HYROX-Kombi: 4 × (1 km Lauf + Station)', detail: 'Laufen direkt nach einer kniefreundlichen Station.', minutes: 40, continuous: true },
];

export function runStep(n: number): RunStep {
  return RUN_LADDER[Math.min(RUN_LADDER.length, Math.max(1, n)) - 1]!;
}

export type RunAdvice = { action: 'up' | 'hold' | 'down'; text: string };

/** Suggestion for the next walk-run session, based on the knee traffic light. */
export function runAdvice(light: KneeLight, step: number, kneeAssessed: boolean): RunAdvice {
  if (light === 'red') return { action: 'down', text: 'Knie-Ampel rot: Laufen pausieren oder eine Stufe zurück; Rad oder Gehen mit Steigung als Ersatz.' };
  if (light === 'yellow') return { action: 'hold', text: 'Knie-Ampel gelb: Stufe halten, nicht steigern.' };
  if (light === 'unknown') return { action: 'hold', text: 'Trage vor und nach dem Lauf deinen Knieschmerz ein, dann zeigt die App eine Empfehlung.' };
  const next = RUN_LADDER[step];
  if (!next) return { action: 'hold', text: 'Höchste Stufe erreicht. Halte den Umfang und koppel Läufe mit Stationen.' };
  if (next.continuous && !kneeAssessed) {
    return { action: 'hold', text: 'Die nächste Stufe ist durchgehendes Laufen. Lass dafür zuerst dein Knie abklären und trage die Abklärung in den Einstellungen ein.' };
  }
  return { action: 'up', text: 'Knie-Ampel grün: Wenn die aktuelle Stufe zweimal beschwerdearm war und der nächste Morgen nicht schlechter ist, ist die nächste Stufe möglich – höchstens eine Stufe pro Woche.' };
}
