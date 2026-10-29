import { useEffect, useState } from 'preact/hooks';

/** Hash routes keep the app working under any GitHub Pages sub path and offline. */
export type Route =
  | { name: 'home' }
  | { name: 'training' }
  | { name: 'workout' }
  | { name: 'exercise'; id: string }
  | { name: 'summary'; id: string }
  | { name: 'template'; id: string }
  | { name: 'calendar'; month?: string }
  | { name: 'physio' }
  | { name: 'knee' }
  | { name: 'library' }
  | { name: 'exerciseInfo'; id: string }
  | { name: 'newExercise' }
  | { name: 'progress' }
  | { name: 'history' }
  | { name: 'session'; id: string }
  | { name: 'settings' }
  | { name: 'data' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  const [a, b] = path.split('/').filter(Boolean).map(decodeURIComponent);
  if (a === 'training') return { name: 'training' };
  if (a === 'workout' && b) return { name: 'exercise', id: b };
  if (a === 'workout') return { name: 'workout' };
  if (a === 'geschafft' && b) return { name: 'summary', id: b };
  if (a === 'vorlage' && b) return { name: 'template', id: b };
  if (a === 'kalender') return { name: 'calendar', ...(b && /^\d{4}-\d{2}$/.test(b) ? { month: b } : {}) };
  if (a === 'physio') return { name: 'physio' };
  if (a === 'knie') return { name: 'knee' };
  if (a === 'uebungen' && b === 'neu') return { name: 'newExercise' };
  if (a === 'uebungen') return { name: 'library' };
  if (a === 'uebung' && b) return { name: 'exerciseInfo', id: b };
  if (a === 'fortschritt') return { name: 'progress' };
  if (a === 'verlauf' && b) return { name: 'session', id: b };
  if (a === 'verlauf') return { name: 'history' };
  if (a === 'einstellungen') return { name: 'settings' };
  if (a === 'daten') return { name: 'data' };
  return { name: 'home' };
}

export function href(route: Route): string {
  const e = encodeURIComponent;
  switch (route.name) {
    case 'home': return '#/';
    case 'training': return '#/training';
    case 'workout': return '#/workout';
    case 'exercise': return `#/workout/${e(route.id)}`;
    case 'summary': return `#/geschafft/${e(route.id)}`;
    case 'template': return `#/vorlage/${e(route.id)}`;
    case 'calendar': return route.month ? `#/kalender/${route.month}` : '#/kalender';
    case 'physio': return '#/physio';
    case 'knee': return '#/knie';
    case 'library': return '#/uebungen';
    case 'exerciseInfo': return `#/uebung/${e(route.id)}`;
    case 'newExercise': return '#/uebungen/neu';
    case 'progress': return '#/fortschritt';
    case 'history': return '#/verlauf';
    case 'session': return `#/verlauf/${e(route.id)}`;
    case 'settings': return '#/einstellungen';
    case 'data': return '#/daten';
  }
}

export function navigate(route: Route, replace = false) {
  const target = href(route);
  if (replace) location.replace(target);
  else location.hash = target;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
