import { describe, expect, it } from 'vitest';
import { kneePoints, kneeStatus, lightOf, type KneePoint } from '../src/domain/knee';
import { DEFAULT_SETTINGS } from '../src/domain/settings';
import { doneSession } from './fixtures';

const s = DEFAULT_SETTINGS;
const pt = (date: string, pain: number, extra: Partial<KneePoint> = {}): KneePoint => ({ date, at: `${date}T12:00:00.000Z`, pain, source: 'check', ...extra });

describe('knee traffic light', () => {
  it('maps pain to colours with the default thresholds', () => {
    expect([0, 2, 3, 4, 5, 10].map((p) => lightOf(p, s))).toEqual(['green', 'green', 'yellow', 'yellow', 'red', 'red']);
  });
  it('is unknown without values and never invents one', () => {
    const st = kneeStatus([], s, '2026-11-04');
    expect(st.light).toBe('unknown');
    expect(st.latest).toBeNull();
  });
  it('uses the latest value and recommends an assessment for red', () => {
    const st = kneeStatus([pt('2026-11-01', 1), pt('2026-11-03', 6)], s, '2026-11-04');
    expect(st.light).toBe('red');
    expect(st.seeProfessional).toBe(true);
  });
  it('raises to yellow when pain rises by 2 during a workout', () => {
    const session = doneSession({ date: '2026-11-03', exerciseId: 'hyrox-skierg', sets: [{ value: 250, timeSec: 60 }], kneeBefore: 0, kneeAfter: 2 });
    const st = kneeStatus(kneePoints([session], []), s, '2026-11-04');
    expect(st.latest?.pain).toBe(2);
    expect(st.light).toBe('yellow');
  });
  it('raises to yellow on a rising trend, never lowers red', () => {
    const rising = [0, 0, 0, 1, 2, 2].map((p, i) => pt(`2026-11-0${i + 1}`, p));
    expect(kneeStatus(rising, s, '2026-11-07').light).toBe('yellow');
    expect(kneeStatus(rising, s, '2026-11-07').trend).toBe('up');
    const red = [...rising.slice(0, 5), pt('2026-11-06', 7)];
    expect(kneeStatus(red, s, '2026-11-07').light).toBe('red');
  });
  it('marks old values as stale', () => {
    expect(kneeStatus([pt('2026-10-01', 1)], s, '2026-11-04').stale).toBe(true);
  });
  it('recommends an assessment while not assessed and recent pain was above green', () => {
    expect(kneeStatus([pt('2026-11-01', 4), pt('2026-11-03', 1)], s, '2026-11-04').seeProfessional).toBe(true);
    expect(kneeStatus([pt('2026-11-01', 4), pt('2026-11-03', 1)], { ...s, kneeAssessed: true }, '2026-11-04').seeProfessional).toBe(false);
  });
});
