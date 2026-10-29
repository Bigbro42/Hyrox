import { useMemo, useState } from 'preact/hooks';
import { CATEGORY_LABELS, LIBRARY_EXERCISES, tierOf } from '../../domain/catalog';
import { EMPTY_FILTER, filterLibrary } from '../../domain/library';
import { REGIONS, type MuscleRegion } from '../../domain/muscles';
import type { Category } from '../../domain/types';
import { useAppState } from '../../state/store';
import { BodyMap } from '../BodyMap';
import { BackLink, TierChip } from '../components';
import { Icon } from '../icons';
import { href } from '../router';

const CATEGORIES: Category[] = ['physio', 'hyrox', 'run', 'strength', 'cardio', 'mobility'];

/** All exercises: search, area, and the body map to find exercises by muscle. */
export function Library() {
  const { data } = useAppState();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [region, setRegion] = useState<MuscleRegion | null>(null);
  const [map, setMap] = useState(false);
  const all = useMemo(() => [...data.customExercises, ...LIBRARY_EXERCISES], [data.customExercises]);
  const list = filterLibrary(all, { ...EMPTY_FILTER, query, category, region });

  return (
    <main class="screen">
      <BackLink to={{ name: 'training' }} label="Training" />
      <header class="page-head" style={{ marginTop: 'var(--space-3)' }}>
        <div><p class="eyebrow">{all.length} Übungen</p><h1 class="title">Übungen</h1></div>
        <a class="icon-btn icon-btn-accent" href={href({ name: 'newExercise' })} aria-label="Eigene Übung anlegen"><Icon name="plus" size={20} /></a>
      </header>

      <label class="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Suchen: Name, Muskel, Gerät" value={query} onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} aria-label="Übung suchen" />
      </label>
      <div class="chips" role="group" aria-label="Bereich">
        {CATEGORIES.map((c) => <button key={c} class="chip-btn" aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)}>{CATEGORY_LABELS[c]}</button>)}
      </div>

      <section class="card map-card">
        <button class="btn btn-ghost btn-sm" aria-expanded={map} onClick={() => setMap(!map)}><Icon name="body" size={16} />Körperkarte{region ? `: ${REGIONS[region].label}` : ''}</button>
        {map && (
          <>
            <BodyMap label="Muskel wählen" selected={region} onSelect={setRegion} />
            <p class="muted small" style={{ margin: 'var(--space-2) 0 0', textAlign: 'center' }}>{region ? `${REGIONS[region].label} – noch einmal tippen zum Aufheben.` : 'Tippe auf einen Muskel, um passende Übungen zu finden.'}</p>
          </>
        )}
      </section>

      <p class="muted small" aria-live="polite" style={{ margin: 'var(--space-3) 0 var(--space-2)' }}>{list.length} Treffer</p>
      {list.length ? (
        <div class="list">
          {list.map((x) => {
            const tier = tierOf(x, data.settings);
            return (
              <a key={x.id} class="row lib-row" href={href({ name: 'exerciseInfo', id: x.id })}>
                {x.media ? <img class="thumb" src={import.meta.env.BASE_URL + x.media.frames[0]} alt="" loading="lazy" /> : <span class="thumb thumb-none"><Icon name={x.category === 'physio' ? 'physio' : x.category === 'run' ? 'run' : x.category === 'hyrox' ? 'bolt' : 'dumbbell'} size={22} /></span>}
                <div class="row-main">
                  <b>{x.name}</b>
                  <small>{CATEGORY_LABELS[x.category]}{x.source === 'custom' ? ' · Eigene' : ''}</small>
                  <small>{x.dose}</small>
                </div>
                {tier !== 'basis' && <TierChip tier={tier} />}
                <Icon name="chevron" size={18} class="chevron" />
              </a>
            );
          })}
        </div>
      ) : <div class="empty"><p class="muted small">Nichts gefunden. Anderen Begriff versuchen oder Filter entfernen.</p></div>}
    </main>
  );
}
