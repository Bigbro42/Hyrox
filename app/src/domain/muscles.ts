/**
 * Muscle regions used by the library and the body map (same regions as FORM., so the licensed
 * Body Muscles atlas can be reused). Each region belongs to one coarse group for quick filters.
 */

export type MuscleGroup = 'legs' | 'glutes' | 'core' | 'back' | 'chest' | 'shoulders' | 'arms';

export type MuscleRegion =
  | 'chest' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques' | 'hipflexors'
  | 'upperback' | 'lats' | 'lowerback'
  | 'glutes' | 'quads' | 'hamstrings' | 'adductors' | 'calves';

export const REGIONS: Record<MuscleRegion, { label: string; group: MuscleGroup; atlas: RegExp }> = {
  chest: { label: 'Brust', group: 'chest', atlas: /^chest/ },
  shoulders: { label: 'Schultern', group: 'shoulders', atlas: /^(shoulder|deltoid)/ },
  biceps: { label: 'Bizeps', group: 'arms', atlas: /^biceps/ },
  triceps: { label: 'Trizeps', group: 'arms', atlas: /^triceps/ },
  forearms: { label: 'Unterarme & Griff', group: 'arms', atlas: /^forearm/ },
  abs: { label: 'Gerade Bauchmuskeln', group: 'core', atlas: /^abs-/ },
  obliques: { label: 'Seitliche Bauchmuskeln', group: 'core', atlas: /^(obliques|serratus)/ },
  hipflexors: { label: 'Hüftbeuger', group: 'legs', atlas: /^hip-flexor/ },
  upperback: { label: 'Oberer Rücken', group: 'back', atlas: /^(traps|nape)/ },
  lats: { label: 'Latissimus', group: 'back', atlas: /^lats/ },
  lowerback: { label: 'Unterer Rücken', group: 'back', atlas: /^(spine|lower-back)/ },
  glutes: { label: 'Gesäß & Hüfte', group: 'glutes', atlas: /^gluteus/ },
  quads: { label: 'Vordere Oberschenkel', group: 'legs', atlas: /^quads/ },
  hamstrings: { label: 'Hintere Oberschenkel', group: 'legs', atlas: /^hamstrings/ },
  adductors: { label: 'Innere Oberschenkel', group: 'legs', atlas: /^adductors/ },
  calves: { label: 'Waden & Schienbein', group: 'legs', atlas: /^(calves|tibialis)/ },
};

export const REGION_IDS = Object.keys(REGIONS) as MuscleRegion[];

export const GROUP_LABELS: Record<MuscleGroup, string> = {
  legs: 'Beine', glutes: 'Gesäß', core: 'Rumpf', back: 'Rücken', chest: 'Brust', shoulders: 'Schultern', arms: 'Arme',
};

export function regionOfAtlas(id: string): MuscleRegion | null {
  for (const r of REGION_IDS) if (REGIONS[r].atlas.test(id)) return r;
  return null;
}
