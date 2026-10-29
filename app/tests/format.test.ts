import { describe, expect, it } from 'vitest';
import { clock, pace, parseClock } from '../src/domain/format';

describe('time formats', () => {
  it('parses minutes:seconds, hours and plain seconds', () => {
    expect(parseClock('4:05')).toBe(245);
    expect(parseClock('1:02:30')).toBe(3750);
    expect(parseClock('75')).toBe(75);
    expect(parseClock('')).toBeNull();
    expect(parseClock('4:75')).toBeUndefined();
    expect(parseClock('abc')).toBeUndefined();
  });
  it('formats clocks and paces', () => {
    expect(clock(65)).toBe('1:05');
    expect(clock(3750)).toBe('1:02:30');
    expect(pace(1000, 342)).toBe('5:42 /km');
    expect(pace(0, 10)).toBe('–');
  });
});
