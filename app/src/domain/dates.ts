import type { IsoDate } from './types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const d = parseDate(value);
  return toIsoDate(d) === value;
}

/** Local calendar date at noon, so DST changes never shift the day. */
export function parseDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12);
}

export function toIsoDate(d: Date): IsoDate {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function today(now = new Date()): IsoDate {
  return toIsoDate(now);
}

export function formatDate(iso: IsoDate, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }): string {
  return parseDate(iso).toLocaleDateString('de-AT', options);
}
