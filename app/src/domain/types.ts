/**
 * HYROX Trainer domain model (one athlete, everything stored locally).
 *
 * Key rules (taken over from FORM.):
 * - A WorkoutSession is something that was actually done (or is being done). Only sessions with
 *   status "completed" count as training in history, statistics and XP.
 * - A PlannedWorkout is a calendar entry. It never counts as training.
 * - Sessions keep a snapshot of every exercise's name and metric, so later edits to the library
 *   or to templates never rewrite history.
 * - Health values (knee pain) are only ever entered by the athlete; nothing is pre-filled.
 */

import type { MuscleRegion } from './muscles';

/** Calendar day in local time, "YYYY-MM-DD". */
export type IsoDate = string;
/** Timestamp, ISO 8601 with time zone. */
export type IsoDateTime = string;

/** What one set is measured in. */
export type Metric = 'reps' | 'seconds' | 'minutes' | 'meters';

export type Category = 'physio' | 'hyrox' | 'run' | 'strength' | 'cardio' | 'mobility';

/**
 * Release status of an exercise for this athlete.
 * basis: regular part of training · optional: may be added · progression: only after the knee
 * tolerates the basics · locked: currently not suitable (individually blocked).
 */
export type Tier = 'basis' | 'optional' | 'progression' | 'locked';

/** Rough load on the front of the knee (patellofemoral load, jumping, deep single-leg bending). */
export type KneeLoad = 'low' | 'medium' | 'high';

export type EquipmentId =
  | 'body' | 'band' | 'dumbbell' | 'kettlebell' | 'barbell' | 'machine' | 'cable' | 'box' | 'bench'
  | 'erg' | 'bike' | 'treadmill' | 'sled' | 'sandbag' | 'wallball' | 'roller';

export type StationId = 'ski' | 'sledpush' | 'sledpull' | 'bbj' | 'row' | 'farmers' | 'lunges' | 'wallballs';

export interface ExerciseMedia {
  /** Start and end position photos, relative to the app's media root. */
  frames: string[];
  credit: string;
  license: string;
  sourceUrl: string;
}

export interface ExerciseDef {
  /** Stable id. Built-in ids must never change (history and backups refer to them). */
  id: string;
  name: string;
  aliases: string[];
  category: Category;
  metric: Metric;
  /** Also log a duration per set (stations, runs, intervals). */
  timed: boolean;
  /** Log an external load in kg. */
  weighted: boolean;
  primaryMuscles: MuscleRegion[];
  secondaryMuscles: MuscleRegion[];
  equipment: EquipmentId[];
  level: 1 | 2 | 3;
  kneeLoad: KneeLoad;
  /** Default release status; the athlete can override it per exercise in the settings. */
  tier: Tier;
  /** Suggested dose shown as orientation, e.g. "3 × 20–30 Sek.". */
  dose: string;
  /** Number of sets a new workout starts with. */
  sets: number;
  restSeconds: number;
  description: string;
  steps: string[];
  mistakes: string[];
  safety: string;
  easier: string;
  harder: string;
  station?: StationId;
  media: ExerciseMedia | null;
  source: 'builtin' | 'custom';
  createdAt?: IsoDateTime;
}

export interface SetEntry {
  id: string;
  /** Value in the exercise's metric (reps, seconds, minutes or meters). */
  value: number | null;
  /** External load in kg (empty for bodyweight). */
  weightKg: number | null;
  /** Duration of the set in seconds (timed exercises only). */
  timeSec: number | null;
  done: boolean;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  /** Snapshot at the time of the session, so history survives library changes. */
  name: string;
  metric: Metric;
  timed: boolean;
  sets: SetEntry[];
  note?: string;
}

export type SessionKind = 'physio' | 'strength' | 'hyrox' | 'football' | 'free';

export type SessionStatus = 'active' | 'draft' | 'completed';

export interface LegacyOrigin {
  /** localStorage key or backup file the record came from. */
  key: string;
  /** Original id inside that source. */
  ref: string;
  /** Fields that had to be inferred because the old app didn't store them. */
  inferred?: string[];
}

export interface WorkoutSession {
  id: string;
  date: IsoDate;
  title: string;
  kind: SessionKind;
  templateId: string | null;
  status: SessionStatus;
  source: 'manual' | 'calendar' | 'legacy';
  exercises: SessionExercise[];
  startedAt: IsoDateTime | null;
  completedAt: IsoDateTime | null;
  durationMin: number | null;
  /** Subjective effort of the whole session, 1–10. */
  rpe: number | null;
  /** Knee pain 0–10 right before and after the session; null = not entered. */
  kneeBefore: number | null;
  kneeAfter: number | null;
  note: string;
  plannedRef?: { planId: string; occurrence: IsoDate };
  /** Set while a completed workout is being corrected; holds the state before the correction. */
  reopened?: { original: Omit<WorkoutSession, 'reopened'> };
  legacy?: LegacyOrigin;
  /** Incremented on every change; 0 = untouched import. */
  rev: number;
  updatedAt: IsoDateTime;
}

export type KneeContext = 'check' | 'morning' | 'football';

/** A knee check outside of a workout (workouts store their own before/after values). */
export interface KneeLog {
  id: string;
  date: IsoDate;
  at: IsoDateTime;
  /** 0 = no pain, 10 = worst imaginable. */
  pain: number;
  context: KneeContext;
  note: string;
  legacy?: LegacyOrigin;
  rev: number;
  updatedAt: IsoDateTime;
}

export interface PlannedExercise {
  exerciseId: string;
  sets: number;
}

/** Weekly units of the standard plan; "F" is football. */
export type Slot = 'A' | 'B' | 'C' | 'F';

export type Recurrence =
  | { freq: 'once' }
  | { freq: 'daily' | 'weekly' | 'monthly'; interval: number; until: IsoDate | null };

export type OccurrenceException =
  | { type: 'skip' }
  | { type: 'move'; to: IsoDate };

export interface PlannedWorkout {
  id: string;
  title: string;
  kind: SessionKind;
  templateId: string | null;
  /** Which weekly unit of the standard plan this series is (absent for own entries). */
  slot?: Slot;
  startsOn: IsoDate;
  time: string | null;
  recurrence: Recurrence;
  /** Keyed by the original occurrence date. */
  exceptions: Record<IsoDate, OccurrenceException>;
  rev: number;
  updatedAt: IsoDateTime;
}

/** Reusable exercise list. Editing a template never changes past workouts. */
export interface WorkoutTemplate {
  id: string;
  name: string;
  kind: SessionKind;
  minutes: number;
  exercises: PlannedExercise[];
  rev: number;
  updatedAt: IsoDateTime;
}

export type FootballDay = 'thursday' | 'sunday' | 'none';

export interface Settings {
  /** Optional, only shown in the app. */
  name: string;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  level: 1 | 2 | 3;
  raceName: string;
  raceDate: IsoDate;
  division: string;
  /** Provisional goal, e.g. "1:30". Not a prediction. */
  targetTime: string;
  /** Monday-ish start of the 16-week plan (week 1). */
  planStart: IsoDate;
  partnerName: string;
  /** Planned own share of the work per station in percent (Doubles split). */
  stationShare: Record<StationId, number>;
  football: FootballDay;
  /** Weekday (0 = Sunday … 6 = Saturday) of the three weekly units. */
  days: Record<'A' | 'B' | 'C', number>;
  /** Knee traffic light: pain ≤ greenMax is green, ≤ yellowMax yellow, above red. */
  kneeGreenMax: number;
  kneeYellowMax: number;
  /** Has the knee been assessed by a physio or sports doctor? Only the athlete sets this. */
  kneeAssessed: boolean;
  /** Per-exercise release status chosen by the athlete (overrides the default tier). */
  status: Record<string, Tier>;
  /** Current step of the walk-run ladder (1-based). */
  runStep: number;
  restSeconds: number;
  restAuto: boolean;
  updatedAt: IsoDateTime;
}

/** Everything that belongs to the athlete. Backups contain exactly this. */
export interface UserData {
  sessions: WorkoutSession[];
  plans: PlannedWorkout[];
  templates: WorkoutTemplate[];
  customExercises: ExerciseDef[];
  knee: KneeLog[];
  settings: Settings;
}
