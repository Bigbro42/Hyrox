import { CATEGORY_LABELS, EQUIPMENT_LABELS } from './catalog';
import { REGIONS, type MuscleGroup, type MuscleRegion } from './muscles';
import type { Category, ExerciseDef } from './types';

export interface LibraryFilter {
  query: string;
  category: Category | null;
  group: MuscleGroup | null;
  region: MuscleRegion | null;
}

export const EMPTY_FILTER: LibraryFilter = { query: '', category: null, group: null, region: null };

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** Search over name, aliases, muscles, equipment and category; filters combine with AND. */
export function filterLibrary(list: readonly ExerciseDef[], f: LibraryFilter): ExerciseDef[] {
  const words = fold(f.query).split(/\s+/).filter(Boolean);
  return list.filter((x) => {
    if (f.category && x.category !== f.category) return false;
    const muscles = [...x.primaryMuscles, ...x.secondaryMuscles];
    if (f.region && !muscles.includes(f.region)) return false;
    if (f.group && !muscles.some((m) => REGIONS[m].group === f.group)) return false;
    if (!words.length) return true;
    const hay = fold([x.name, ...x.aliases, ...muscles.map((m) => REGIONS[m].label), ...x.equipment.map((e) => EQUIPMENT_LABELS[e]), CATEGORY_LABELS[x.category]].join(' '));
    return words.every((w) => hay.includes(w));
  });
}
