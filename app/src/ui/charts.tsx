/**
 * Small single-series SVG charts. Tapping or focusing a mark shows its exact value in the
 * readout line above the plot (works with touch, mouse and keyboard); every chart can be
 * shown as a table. No legend: the title names the single series.
 */
import { useState } from 'preact/hooks';

export interface Datum {
  key: string;
  /** Short axis label. */
  label: string;
  value: number;
  /** Readout text, e.g. "KW 43: 3 Trainings". */
  detail: string;
}

function Readout({ text, fallback }: { text: string | null; fallback: string }) {
  return <p class="chart-readout" aria-live="polite">{text ?? fallback}</p>;
}

function TableToggle({ data, valueLabel }: { data: Datum[]; valueLabel: string }) {
  return (
    <details class="chart-table">
      <summary>Als Tabelle</summary>
      <table class="sets">
        <thead><tr><th scope="col">Zeitraum</th><th scope="col">{valueLabel}</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.key}><td>{d.label}</td><td>{d.detail}</td></tr>)}</tbody>
      </table>
    </details>
  );
}

const W = 320;
const H = 140;
const PAD = { top: 8, right: 4, bottom: 20, left: 4 };

/** Vertical bars from a zero baseline, rounded data end. */
export function BarChart({ data, title, valueLabel, summary }: { data: Datum[]; title: string; valueLabel: string; summary: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(18, slot - 6);
  const labelEvery = Math.ceil(data.length / 6);
  return (
    <figure class="chart">
      <Readout text={active !== null ? data[active]!.detail : null} fallback={summary} />
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={title} class="chart-svg" onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}>
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} class="chart-axis" />
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max(3, (d.value / max) * innerH) : 0;
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const y = H - PAD.bottom - h;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={d.key} class={`chart-mark${active === i ? ' is-active' : ''}`} tabIndex={0} role="button" aria-label={d.detail}
              onClick={() => setActive(active === i ? null : i)} onFocus={() => setActive(i)} onPointerMove={(e) => e.pointerType === 'mouse' && setActive(i)}>
              {/* Hit target spans the full slot height, larger than the bar itself. */}
              <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={innerH + PAD.bottom} class="chart-hit" />
              {h > 0 && <path class="chart-bar" d={`M${x},${H - PAD.bottom} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${H - PAD.bottom} Z`} />}
              {(data.length - 1 - i) % labelEvery === 0 && <text x={x + barW / 2} y={H - 5} class="chart-label" text-anchor="middle">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      <TableToggle data={data} valueLabel={valueLabel} />
    </figure>
  );
}

/** Points connected by a 2px line, y-range from the data (min/max labelled). */
export function LineChart({ data, title, valueLabel, summary, unit }: { data: Datum[]; title: string; valueLabel: string; summary: string; unit: string }) {
  const [active, setActive] = useState<number | null>(data.length ? data.length - 1 : null);
  if (data.length < 2) {
    return <p class="muted small" style={{ margin: 0 }}>{data.length === 1 ? `Bisher ein Eintrag: ${data[0]!.detail}. Ab dem zweiten Training siehst du hier den Verlauf.` : 'Noch keine Einträge.'}</p>;
  }
  const values = data.map((d) => d.value);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  let lo = dataMin;
  let hi = dataMax;
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.15;
  lo = Math.max(0, lo - pad);
  hi += pad;
  const left = 34;
  const innerW = W - left - 10;
  const innerH = H - PAD.top - PAD.bottom;
  const px = (i: number) => left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const py = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const fmt = (v: number) => v.toLocaleString('de-AT', { maximumFractionDigits: 1 });
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(d.value).toFixed(1)}`).join(' ');
  const a = active ?? data.length - 1;
  return (
    <figure class="chart">
      <Readout text={active !== null ? data[a]!.detail : null} fallback={summary} />
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={title} class="chart-svg">
        {/* Axis labels show the real lowest and highest value, not padded helper values. */}
        {[...new Set([dataMax, dataMin])].map((v) => (
          <g key={v}>
            <line x1={left} x2={W - 10} y1={py(v)} y2={py(v)} class="chart-grid" />
            <text x={left - 6} y={py(v) + 4} class="chart-label" text-anchor="end">{fmt(v)}</text>
          </g>
        ))}
        <path d={line} class="chart-line" />
        {active !== null && <line x1={px(a)} x2={px(a)} y1={PAD.top} y2={H - PAD.bottom} class="chart-cross" />}
        {data.map((d, i) => (
          <g key={d.key} class={`chart-mark${active === i ? ' is-active' : ''}`} tabIndex={0} role="button" aria-label={d.detail}
            onClick={() => setActive(i)} onFocus={() => setActive(i)} onPointerMove={(e) => e.pointerType === 'mouse' && setActive(i)}>
            <rect x={px(i) - Math.max(8, innerW / data.length / 2)} y={PAD.top} width={Math.max(16, innerW / data.length)} height={innerH} class="chart-hit" />
            <circle cx={px(i)} cy={py(d.value)} r={active === i ? 5.5 : 4} class="chart-dot" />
          </g>
        ))}
        <text x={left} y={H - 5} class="chart-label">{data[0]!.label}</text>
        <text x={W - 10} y={H - 5} class="chart-label" text-anchor="end">{data.at(-1)!.label}</text>
      </svg>
      <span class="visually-hidden">Einheit: {unit}</span>
      <TableToggle data={data} valueLabel={valueLabel} />
    </figure>
  );
}
