/** Built-in exercise library, labels and the per-athlete release status. */
import { HYROX_EXERCISES } from '../data/exercises-hyrox';
import { PHYSIO_EXERCISES } from '../data/exercises-physio';
import { TRAINING_EXERCISES } from '../data/exercises-training';
import { REGIONS } from './muscles';
import type { Category, EquipmentId, ExerciseDef, KneeLoad, Metric, Settings, StationId, Tier } from './types';

export const LIBRARY_EXERCISES: readonly ExerciseDef[] = [...PHYSIO_EXERCISES, ...HYROX_EXERCISES, ...TRAINING_EXERCISES];

const BY_ID = new Map(LIBRARY_EXERCISES.map((x) => [x.id, x]));

export function builtin(id: string): ExerciseDef | undefined {
  return BY_ID.get(id);
}

export function makeLookup(custom: readonly ExerciseDef[]) {
  const own = new Map(custom.map((x) => [x.id, x]));
  return (id: string): ExerciseDef | undefined => BY_ID.get(id) ?? own.get(id);
}

export type Lookup = ReturnType<typeof makeLookup>;

export const STATION_ORDER: StationId[] = ['ski', 'sledpush', 'sledpull', 'bbj', 'row', 'farmers', 'lunges', 'wallballs'];

export function stationExercise(station: StationId): ExerciseDef {
  return HYROX_EXERCISES.find((x) => x.station === station)!;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  physio: 'Physio', hyrox: 'HYROX-Station', run: 'Laufen', strength: 'Kraft', cardio: 'Ausdauer', mobility: 'Mobilität',
};

export const TIER_LABELS: Record<Tier, { label: string; long: string }> = {
  basis: { label: 'Basis', long: 'Regulärer Bestandteil des Trainings' },
  optional: { label: 'Optional', long: 'Kann bei guter Verträglichkeit ergänzt werden' },
  progression: { label: 'Spätere Progression', long: 'Erst wenn die Basis beschwerdearm gelingt' },
  locked: { label: 'Aktuell gesperrt', long: 'Derzeit nicht geeignet – nur nach individueller Freigabe' },
};

export const TIER_ORDER: Tier[] = ['basis', 'optional', 'progression', 'locked'];

export const KNEE_LOAD_LABELS: Record<KneeLoad, string> = {
  low: 'Geringe Kniebelastung', medium: 'Mittlere Kniebelastung', high: 'Hohe Kniebelastung',
};

export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  body: 'Körpergewicht', band: 'Band', dumbbell: 'Kurzhantel', kettlebell: 'Kettlebell', barbell: 'Langhantel',
  machine: 'Maschine', cable: 'Kabelzug', box: 'Box/Stufe', bench: 'Bank', erg: 'Ergometer', bike: 'Rad',
  treadmill: 'Laufband', sled: 'Schlitten', sandbag: 'Sandsack', wallball: 'Wall Ball', roller: 'Schaumstoffrolle',
};

export const METRIC_LABELS: Record<Metric, { short: string; long: string }> = {
  reps: { short: 'Wdh.', long: 'Wiederholungen' },
  seconds: { short: 'Sek.', long: 'Sekunden' },
  minutes: { short: 'Min.', long: 'Minuten' },
  meters: { short: 'm', long: 'Meter' },
};

export function muscleText(def: Pick<ExerciseDef, 'primaryMuscles'>): string {
  return def.primaryMuscles.map((m) => REGIONS[m].label).join(', ') || 'Ganzkörper';
}

/** Release status for this athlete: own choice in the settings, otherwise the default tier. */
export function tierOf(def: Pick<ExerciseDef, 'id' | 'tier'>, settings: Pick<Settings, 'status'>): Tier {
  return settings.status[def.id] ?? def.tier;
}

/**
 * Names used by the previous single-file app (localStorage `form-hyrox-trainer-v1`) → ids.
 * Unknown names become own exercises during the import.
 */
export const LEGACY_NAMES: Record<string, string> = {
  'Radfahren locker': 'cardio-bike-easy',
  SkiErg: 'hyrox-skierg',
  RowErg: 'hyrox-rowerg',
  'Farmers Carry': 'hyrox-farmers-carry',
  'Sled Push': 'hyrox-sled-push',
  'Sled Pull': 'hyrox-sled-pull',
  'Wall Balls': 'hyrox-wall-balls',
  'Burpee Broad Jumps': 'hyrox-burpee-broad-jump',
  'Sandbag Lunges': 'hyrox-sandbag-lunges',
  Bankdrücken: 'strength-bench-press',
  'Rumänisches Kreuzheben': 'strength-rdl',
  Kabelrudern: 'strength-cable-row',
  'Glute Bridge': 'strength-glute-bridge',
  Wadenheben: 'strength-calf-raise',
  'Lockeres Laufen/Gehen': 'run-walk-intervals',
  'Spanish Squat': 'physio-spanish-squat',
  'Lunge Hold mit Zehen auf Erhöhung': 'physio-lunge-hold-toes',
  'Lunge + Jump': 'physio-lunge-jump',
  'Copenhagen Plank': 'physio-copenhagen',
  'Poliquin Step Down': 'physio-poliquin-step-down',
  'Sissy Squat': 'physio-sissy-squat',
  'Alternating Toe Taps Standing (Barbell)': 'physio-toe-taps-barbell',
  'Box Step Down (Tempo)': 'physio-box-step-down',
  'Tibialis Rotation': 'physio-tibialis-rotation',
  'SL Hamstring Bridge isometrisch': 'physio-sl-hamstring-bridge',
  'Single Leg Box Jumps': 'physio-sl-box-jump',
  'Seated Leg Raise': 'physio-seated-leg-raise',
  'Seated Hip Internal Rotation': 'physio-seated-hip-ir',
  'Band Resisted Crossover Step': 'physio-band-crossover-step',
  'Banded Lunge Heel Tap': 'physio-banded-lunge-heel-tap',
};
