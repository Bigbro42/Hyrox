import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { TIER_LABELS } from '../domain/catalog';
import { formatDate, parseDate } from '../domain/dates';
import { LIGHT_LABELS, type KneeLight } from '../domain/knee';
import { KIND_LABELS } from '../domain/templates';
import type { Tier, WorkoutSession } from '../domain/types';
import { Icon, type IconName } from './icons';
import { href, type Route } from './router';

export function Notice({ tone, title, children, icon }: { tone: 'info' | 'warn' | 'error'; title?: string; children: ComponentChildren; icon?: IconName }) {
  return (
    <div class={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={icon ?? (tone === 'info' ? 'info' : 'alert')} size={20} />
      <div>
        {title && <b>{title}</b>}
        {children}
      </div>
    </div>
  );
}

export function BackLink({ to, label }: { to: Route; label: string }) {
  return <a class="btn btn-ghost back-link" href={href(to)}><Icon name="back" size={18} />{label}</a>;
}

export function StatusChip({ status }: { status: WorkoutSession['status'] }) {
  if (status === 'completed') return <span class="chip chip-done"><Icon name="check" size={14} />Abgeschlossen</span>;
  if (status === 'active') return <span class="chip chip-neutral">Läuft</span>;
  return <span class="chip chip-draft">Nicht abgeschlossen</span>;
}

export function TierChip({ tier }: { tier: Tier }) {
  return <span class={`chip chip-tier-${tier}`}>{tier === 'locked' && <Icon name="lock" size={12} />}{TIER_LABELS[tier].label}</span>;
}

export function LightDot({ light, label }: { light: KneeLight; label?: boolean }) {
  return (
    <span class={`light light-${light}`}>
      <i aria-hidden="true" />
      {label !== false && <span>{LIGHT_LABELS[light]}</span>}
    </span>
  );
}

const KIND_ICONS: Record<WorkoutSession['kind'], IconName> = { physio: 'physio', strength: 'dumbbell', hyrox: 'bolt', football: 'football', free: 'play' };

export function KindIcon({ kind, size = 20 }: { kind: WorkoutSession['kind']; size?: number }) {
  return <span class={`kind-icon kind-${kind}`} aria-hidden="true"><Icon name={KIND_ICONS[kind]} size={size} /></span>;
}

export function SessionRow({ session }: { session: WorkoutSession }) {
  const d = parseDate(session.date);
  const sets = session.exercises.reduce((n, x) => n + x.sets.filter((s) => s.value !== null || s.timeSec !== null).length, 0);
  const detail = session.kind === 'football'
    ? `${session.durationMin ? `${session.durationMin} Min.` : 'Fußball'}${session.kneeAfter !== null ? ` · Knie ${session.kneeAfter}/10` : ''}`
    : `${session.exercises.length} ${session.exercises.length === 1 ? 'Übung' : 'Übungen'} · ${sets} ${sets === 1 ? 'Satz' : 'Sätze'}${session.kneeAfter !== null ? ` · Knie ${session.kneeAfter}/10` : ''}`;
  return (
    <a class="row" href={href({ name: 'session', id: session.id })} aria-label={`${session.title}, ${formatDate(session.date, { dateStyle: 'full' })}`}>
      <div class="row-date" aria-hidden="true">
        <b>{d.getDate()}</b>
        <small>{d.toLocaleDateString('de-AT', { weekday: 'short' }).replace('.', '')}</small>
      </div>
      <div class="row-main">
        <b>{session.title}</b>
        <small>{KIND_LABELS[session.kind]} · {detail}</small>
      </div>
      {session.status !== 'completed' && <StatusChip status={session.status} />}
      <Icon name="chevron" size={18} class="chevron" />
    </a>
  );
}

/** Bottom sheet dialog with focus handling and Escape to close. */
export function Sheet({ title, onClose, children, tall }: { title: string; onClose: () => void; children: ComponentChildren; tall?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('sheet-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('sheet-open');
      previous?.focus();
    };
  }, []);
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && close.current()}>
      <div class={`sheet${tall ? ' sheet-tall' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div class="sheet-head">
          <h2 class="h2">{title}</h2>
          <button class="icon-btn icon-btn-sm" onClick={() => close.current()} aria-label="Schließen"><Icon name="close" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Knee pain 0–10 as eleven buttons. Nothing is pre-selected: a value only exists when the athlete
 * picks it. Colours follow the traffic light thresholds.
 */
export function PainScale({ value, onChange, label, greenMax, yellowMax }: { value: number | null; onChange: (v: number | null) => void; label: string; greenMax: number; yellowMax: number }) {
  return (
    <div class="pain" role="radiogroup" aria-label={label}>
      {Array.from({ length: 11 }, (_, n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} von 10`}
          class={`pain-btn pain-${n <= greenMax ? 'green' : n <= yellowMax ? 'yellow' : 'red'}`}
          onClick={() => onChange(value === n ? null : n)}>{n}</button>
      ))}
    </div>
  );
}

export function monthLabel(iso: string): string {
  return parseDate(iso).toLocaleDateString('de-AT', { month: 'long', year: 'numeric' });
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div class="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div class="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
