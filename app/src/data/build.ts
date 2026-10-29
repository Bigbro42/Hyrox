/**
 * Helper for the built-in exercise content. Only the fields that differ from the defaults are
 * written in the content files; `photo` is a folder in /media/exercises (Free Exercise DB).
 */
import type { ExerciseDef } from '../domain/types';

const PHOTO_CREDIT = {
  credit: 'Free Exercise DB',
  license: 'Unlicense (gemeinfrei)',
  sourceUrl: 'https://github.com/yuhonas/free-exercise-db',
};

export type ExerciseInput = Omit<ExerciseDef, 'aliases' | 'secondaryMuscles' | 'timed' | 'weighted' | 'level' | 'restSeconds' | 'easier' | 'harder' | 'mistakes' | 'media' | 'source' | 'sets'>
  & Partial<Pick<ExerciseDef, 'aliases' | 'secondaryMuscles' | 'timed' | 'weighted' | 'level' | 'restSeconds' | 'easier' | 'harder' | 'mistakes' | 'sets'>>
  & { photo?: string };

export function exercise({ photo, ...x }: ExerciseInput): ExerciseDef {
  return {
    aliases: [],
    secondaryMuscles: [],
    timed: false,
    weighted: false,
    level: 1,
    restSeconds: 60,
    easier: '',
    harder: '',
    mistakes: [],
    sets: 2,
    ...x,
    media: photo ? { frames: [0, 1].map((n) => `media/exercises/${photo}/${n}.jpg`), ...PHOTO_CREDIT } : null,
    source: 'builtin',
  };
}
