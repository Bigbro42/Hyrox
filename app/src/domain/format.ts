export function fmtNum(n: number): string {
  return n.toLocaleString('de-AT', { maximumFractionDigits: 2 });
}

/** "4:05" for minutes:seconds, "1:02:30" from one hour on. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Parses "4:05", "1:02:30" or plain seconds ("245"). Empty = null; junk = undefined. */
export function parseClock(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t));
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/.exec(t);
  if (!m) return undefined;
  const [, h, min, sec] = m;
  if (Number(sec) > 59 || (h !== undefined && Number(min) > 59)) return undefined;
  return Number(h ?? 0) * 3600 + Number(min) * 60 + Number(sec);
}

/** Running pace "5:42 /km" from meters and seconds. */
export function pace(meters: number, seconds: number): string {
  if (meters <= 0 || seconds <= 0) return '–';
  return `${clock((seconds / meters) * 1000)} /km`;
}

export const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
