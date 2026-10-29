import atlas from '../data/atlas.json';
import { regionOfAtlas, REGIONS, type MuscleRegion } from '../domain/muscles';

type View = 'front' | 'back';

interface AtlasPath { id: string; d: string }

/** Paths of each view grouped by muscle region; parts without a region (head, hands …) are decoration. */
function grouped(view: View) {
  const regions = new Map<MuscleRegion, string[]>();
  const other: string[] = [];
  for (const p of (atlas[view].paths as AtlasPath[])) {
    const r = regionOfAtlas(p.id);
    if (r) regions.set(r, [...(regions.get(r) ?? []), p.d]);
    else other.push(p.d);
  }
  return { regions, other };
}

const VIEWS = { front: grouped('front'), back: grouped('back') };

/**
 * Gender-neutral anatomical body map (front and back side by side).
 * Interactive when `onSelect` is given; otherwise a labelled muscle overview.
 */
export function BodyMap({ primary = [], secondary = [], selected = null, onSelect, label, levels }: {
  primary?: readonly MuscleRegion[];
  secondary?: readonly MuscleRegion[];
  selected?: MuscleRegion | null;
  onSelect?: (r: MuscleRegion | null) => void;
  label: string;
  /** Sequential heat levels 1–3 (one hue, light → strong), e.g. trained sets per region. */
  levels?: Partial<Record<MuscleRegion, 0 | 1 | 2 | 3>>;
}) {
  const interactive = Boolean(onSelect);
  const view = (v: View) => {
    const { regions, other } = VIEWS[v];
    return (
      <figure class="body-view">
        <svg viewBox={atlas[v].viewBox} role={interactive ? 'group' : 'img'} aria-label={`${label}: ${v === 'front' ? 'Vorderansicht' : 'Rückansicht'}`}>
          {other.map((d, i) => <path key={i} d={d} class="bm-base" />)}
          {[...regions.entries()].map(([r, ds]) => {
            const level = levels?.[r] ?? 0;
            const cls = `bm-muscle${primary.includes(r) ? ' bm-primary' : secondary.includes(r) ? ' bm-secondary' : ''}${level ? ` bm-l${level}` : ''}${selected === r ? ' bm-selected' : ''}`;
            const name = REGIONS[r].label;
            return interactive ? (
              <g key={r} class={cls} role="button" tabIndex={0} aria-pressed={selected === r} aria-label={name}
                onClick={() => onSelect!(selected === r ? null : r)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect!(selected === r ? null : r); } }}>
                <title>{name}</title>
                {ds.map((d, i) => <path key={i} d={d} />)}
              </g>
            ) : (
              <g key={r} class={cls}>{ds.map((d, i) => <path key={i} d={d} />)}</g>
            );
          })}
        </svg>
        <figcaption>{v === 'front' ? 'Vorne' : 'Hinten'}</figcaption>
      </figure>
    );
  };
  return (
    <div class="body-map">
      {view('front')}
      {view('back')}
    </div>
  );
}
