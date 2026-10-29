/**
 * Knee pain monitoring and the traffic light. The rules are a transparent, conservative default
 * (pain-monitoring approach common in physiotherapy) and can be adjusted in the settings. They
 * never diagnose and never release jumps or intensive running on their own.
 */
import { parseDate, toIsoDate } from './dates';
import type { IsoDate, IsoDateTime, KneeLog, Settings, WorkoutSession } from './types';

export type KneeSource = 'check' | 'morning' | 'football' | 'before' | 'after';

export interface KneePoint {
  date: IsoDate;
  at: IsoDateTime;
  pain: number;
  source: KneeSource;
  sessionId?: string;
}

export const SOURCE_LABELS: Record<KneeSource, string> = {
  check: 'Knie-Check', morning: 'Am Morgen', football: 'Nach Fußball', before: 'Vor dem Training', after: 'Nach dem Training',
};

export function validPain(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10;
}

/** All knee values in time order, from check-ins and from the before/after values of workouts. */
export function kneePoints(sessions: readonly WorkoutSession[], logs: readonly KneeLog[]): KneePoint[] {
  const out: KneePoint[] = logs.filter((l) => validPain(l.pain)).map((l) => ({ date: l.date, at: l.at, pain: l.pain, source: l.context }));
  for (const s of sessions) {
    if (s.status === 'active' && s.kneeBefore === null) continue;
    const start = s.startedAt ?? `${s.date}T12:00:00.000Z`;
    if (validPain(s.kneeBefore)) out.push({ date: s.date, at: start, pain: s.kneeBefore, source: 'before', sessionId: s.id });
    if (s.status === 'completed' && validPain(s.kneeAfter)) {
      out.push({ date: s.date, at: s.completedAt ?? start, pain: s.kneeAfter, source: s.kind === 'football' ? 'football' : 'after', sessionId: s.id });
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export type KneeLight = 'green' | 'yellow' | 'red' | 'unknown';

export interface KneeStatus {
  light: KneeLight;
  latest: KneePoint | null;
  /** The latest value is older than a week. */
  stale: boolean;
  trend: 'up' | 'down' | 'flat' | null;
  /** Why the light has this colour. */
  reason: string;
  advice: string;
  /** Recommend a professional assessment. */
  seeProfessional: boolean;
}

export const LIGHT_LABELS: Record<KneeLight, string> = { green: 'Grün', yellow: 'Gelb', red: 'Rot', unknown: 'Kein Wert' };

export function lightOf(pain: number, s: Pick<Settings, 'kneeGreenMax' | 'kneeYellowMax'>): Exclude<KneeLight, 'unknown'> {
  return pain <= s.kneeGreenMax ? 'green' : pain <= s.kneeYellowMax ? 'yellow' : 'red';
}

const ADVICE: Record<KneeLight, string> = {
  green: 'Belastung wie geplant. Steigerungen nur schrittweise und eine nach der anderen.',
  yellow: 'Belastung halten, nicht steigern. Übungen, die Schmerzen auslösen, durch kniefreundliche Varianten ersetzen.',
  red: 'Heute schonen: kniebelastende Übungen ersetzen oder auslassen, Fußball und Laufen pausieren. Bei anhaltenden oder zunehmenden Beschwerden sportmedizinisch oder physiotherapeutisch abklären lassen.',
  unknown: 'Trage vor und nach dem Training deinen Knieschmerz ein. Dann kann die App Belastung und Beschwerden nachvollziehbar verknüpfen.',
};

function addDays(iso: IsoDate, n: number): IsoDate {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

const RANK: Record<Exclude<KneeLight, 'unknown'>, number> = { green: 0, yellow: 1, red: 2 };
const worse = (a: Exclude<KneeLight, 'unknown'>, b: Exclude<KneeLight, 'unknown'>) => (RANK[b] > RANK[a] ? b : a);

/**
 * Traffic light from the latest value, raised (never lowered) by two more rules:
 * - pain after a workout is 2 or more points above the value before it,
 * - the average of the last three values is at least 1 point above the three before.
 */
export function kneeStatus(points: readonly KneePoint[], settings: Pick<Settings, 'kneeGreenMax' | 'kneeYellowMax' | 'kneeAssessed'>, today: IsoDate): KneeStatus {
  const latest = points.at(-1) ?? null;
  const recentHigh = points.some((p) => p.date >= addDays(today, -30) && p.pain > settings.kneeGreenMax);
  if (!latest) {
    return { light: 'unknown', latest: null, stale: false, trend: null, reason: 'Noch kein Kniewert eingetragen.', advice: ADVICE.unknown, seeProfessional: false };
  }
  let light = lightOf(latest.pain, settings);
  let reason = `Letzter Wert ${latest.pain}/10 (${SOURCE_LABELS[latest.source]}).`;

  const lastSession = [...points].reverse().find((p) => p.source === 'after' || p.source === 'football');
  if (lastSession?.sessionId) {
    const before = points.find((p) => p.sessionId === lastSession.sessionId && p.source === 'before');
    if (before && lastSession.pain - before.pain >= 2 && lastSession.date >= addDays(today, -7)) {
      const raised = worse(light, 'yellow');
      if (raised !== light) reason += ` Beim letzten Training ist der Schmerz von ${before.pain} auf ${lastSession.pain} gestiegen.`;
      light = raised;
    }
  }

  let trend: KneeStatus['trend'] = null;
  if (points.length >= 6) {
    const avg = (xs: readonly KneePoint[]) => xs.reduce((n, p) => n + p.pain, 0) / xs.length;
    const diff = avg(points.slice(-3)) - avg(points.slice(-6, -3));
    trend = diff >= 1 ? 'up' : diff <= -1 ? 'down' : 'flat';
    if (trend === 'up') {
      const raised = worse(light, 'yellow');
      if (raised !== light) reason += ' Die letzten Werte steigen.';
      light = raised;
    }
  }

  const stale = latest.date < addDays(today, -7);
  return {
    light,
    latest,
    stale,
    trend,
    reason,
    advice: ADVICE[light],
    seeProfessional: light === 'red' || (!settings.kneeAssessed && recentHigh),
  };
}
