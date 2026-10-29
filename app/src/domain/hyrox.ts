/**
 * Race facts. Distances and Mixed Doubles loads as listed in the HYROX 26/27 Doubles rulebook
 * (June 2026) according to an October 2026 web search; the PDF itself could not be opened from the
 * build environment. Always check hyrox.com before the race.
 */
import type { StationId } from './types';

export interface StationFacts {
  /** Race volume in the station's metric (meters, wall balls: repetitions). */
  amount: number;
  unit: 'm' | 'Wdh.';
  /** Mixed Doubles load as text (empty: bodyweight). */
  load: string;
}

export const RACE_STATIONS: Record<StationId, StationFacts> = {
  ski: { amount: 1000, unit: 'm', load: '' },
  sledpush: { amount: 50, unit: 'm', load: '152 kg inkl. Schlitten' },
  sledpull: { amount: 50, unit: 'm', load: '103 kg inkl. Schlitten' },
  bbj: { amount: 80, unit: 'm', load: '' },
  row: { amount: 1000, unit: 'm', load: '' },
  farmers: { amount: 200, unit: 'm', load: '2 × 24 kg' },
  lunges: { amount: 100, unit: 'm', load: '20 kg' },
  wallballs: { amount: 100, unit: 'Wdh.', load: '6 kg' },
};

export const RACE_RUNS = 8;
export const RACE_RUN_METERS = 1000;
/** Assumed time in the Roxzone (transitions between running and stations), in seconds. */
export const ROXZONE_SECONDS = 8 * 60;

export const DOUBLES_RULES = [
  'Ihr lauft alle 8 × 1 km gemeinsam – das langsamere Tempo bestimmt euer Lauftempo.',
  'Die Arbeit an den Stationen dürft ihr frei aufteilen; es arbeitet immer nur eine Person.',
  'Gewichte im Mixed Doubles laut Regelwerk 26/27 – vor dem Rennen auf hyrox.com prüfen.',
];

export const RULES_SOURCE = 'HYROX Rulebook Doubles 26/27 (Stand Juni 2026)';
