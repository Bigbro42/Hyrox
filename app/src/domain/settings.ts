import { isIsoDate } from './dates';
import type { FootballDay, Settings, StationId, Tier } from './types';

const STATIONS: StationId[] = ['ski', 'sledpush', 'sledpull', 'bbj', 'row', 'farmers', 'lunges', 'wallballs'];
const TIERS = new Set<Tier>(['basis', 'optional', 'progression', 'locked']);
const FOOTBALL = new Set<FootballDay>(['thursday', 'sunday', 'none']);

/**
 * Defaults contain no personal or health data: name, body data and knee values are entered by
 * the athlete and only ever stored on the device.
 */
export const DEFAULT_SETTINGS: Settings = {
  name: '',
  birthYear: null,
  heightCm: null,
  weightKg: null,
  level: 2,
  raceName: 'HYROX Wien',
  raceDate: '2027-02-19',
  division: 'Mixed Doubles',
  targetTime: '1:30',
  planStart: '2026-10-26',
  partnerName: '',
  stationShare: Object.fromEntries(STATIONS.map((s) => [s, 50])) as Record<StationId, number>,
  football: 'thursday',
  days: { A: 3, B: 1, C: 6 },
  kneeGreenMax: 2,
  kneeYellowMax: 4,
  kneeAssessed: false,
  status: {},
  runStep: 1,
  restSeconds: 90,
  restAuto: true,
  updatedAt: '1970-01-01T00:00:00.000Z',
};

const clampInt = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : NaN;
  return Number.isNaN(n) ? fallback : Math.min(hi, Math.max(lo, n));
};

const optional = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null;

const text = (v: unknown, max: number, fallback: string) => (typeof v === 'string' ? v.slice(0, max) : fallback);

/** Repairs settings from storage or a backup; unknown or broken values fall back to defaults. */
export function normalizeSettings(input: Partial<Settings> | undefined | null): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(input ?? {}) };
  const d = DEFAULT_SETTINGS;
  const greenMax = clampInt(s.kneeGreenMax, 0, 9, d.kneeGreenMax);
  const status: Record<string, Tier> = {};
  if (s.status && typeof s.status === 'object') {
    for (const [k, v] of Object.entries(s.status)) if (TIERS.has(v)) status[k] = v;
  }
  return {
    name: text(s.name, 60, ''),
    birthYear: optional(s.birthYear, 1920, 2020),
    heightCm: optional(s.heightCm, 100, 250),
    weightKg: optional(s.weightKg, 30, 250),
    level: ([1, 2, 3] as const).includes(s.level) ? s.level : d.level,
    raceName: text(s.raceName, 60, d.raceName) || d.raceName,
    raceDate: isIsoDate(s.raceDate) ? s.raceDate : d.raceDate,
    division: text(s.division, 40, d.division),
    targetTime: text(s.targetTime, 10, d.targetTime),
    planStart: isIsoDate(s.planStart) ? s.planStart : d.planStart,
    partnerName: text(s.partnerName, 60, ''),
    stationShare: Object.fromEntries(STATIONS.map((st) => [st, clampInt(s.stationShare?.[st], 0, 100, 50)])) as Record<StationId, number>,
    football: FOOTBALL.has(s.football) ? s.football : d.football,
    days: {
      A: clampInt(s.days?.A, 0, 6, d.days.A),
      B: clampInt(s.days?.B, 0, 6, d.days.B),
      C: clampInt(s.days?.C, 0, 6, d.days.C),
    },
    kneeGreenMax: greenMax,
    kneeYellowMax: clampInt(s.kneeYellowMax, greenMax, 10, Math.max(greenMax, d.kneeYellowMax)),
    kneeAssessed: s.kneeAssessed === true,
    status,
    runStep: clampInt(s.runStep, 1, 9, 1),
    restSeconds: clampInt(s.restSeconds, 0, 600, d.restSeconds),
    restAuto: s.restAuto !== false,
    updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : d.updatedAt,
  };
}
