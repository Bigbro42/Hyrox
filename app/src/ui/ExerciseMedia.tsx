import { useState } from 'preact/hooks';
import { REGIONS } from '../domain/muscles';
import type { ExerciseDef } from '../domain/types';
import { BodyMap } from './BodyMap';

const BASE = import.meta.env.BASE_URL;

/** Start/end photos where a matching one exists, otherwise a clearly labelled muscle overview. */
export function ExerciseMedia({ def }: { def: ExerciseDef | undefined }) {
  const [broken, setBroken] = useState(false);
  if (def?.media && !broken) {
    return (
      <figure class="media">
        <div class="media-frames">
          {def.media.frames.map((src, i) => (
            <div class="media-frame" key={src}>
              <img src={BASE + src} alt={`${def.name} – ${i === 0 ? 'Startposition' : 'Endposition'}`} loading="lazy" decoding="async" onError={() => setBroken(true)} />
              <span>{i === 0 ? 'Start' : 'Ende'}</span>
            </div>
          ))}
        </div>
        <figcaption>Foto: <a href={def.media.sourceUrl} target="_blank" rel="noopener">{def.media.credit}</a> ({def.media.license})</figcaption>
      </figure>
    );
  }
  if (!def?.primaryMuscles.length) return null;
  // No verified photo: show the muscles, clearly labelled, never a different exercise.
  return (
    <section class="muscle-card" aria-label="Muskelübersicht">
      <p class="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Muskelübersicht · keine Bewegungsdemonstration</p>
      <div class="muscle-card-body">
        <BodyMap label={`Muskeln bei ${def.name}`} primary={def.primaryMuscles} secondary={def.secondaryMuscles} />
        <div class="facts" style={{ marginTop: 0, alignContent: 'start' }}>
          {def.primaryMuscles.map((m) => <span key={m} class="chip chip-done">{REGIONS[m].label}</span>)}
          {def.secondaryMuscles.map((m) => <span key={m} class="chip chip-neutral">{REGIONS[m].label}</span>)}
        </div>
      </div>
      {broken && <p class="muted small" style={{ margin: 'var(--space-2) 0 0' }}>Das Foto konnte nicht geladen werden.</p>}
    </section>
  );
}
