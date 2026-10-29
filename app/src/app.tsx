import { builtin } from './domain/catalog';
import { start, useAppState } from './state/store';
import { Icon, type IconName } from './ui/icons';
import { href, useRoute, type Route } from './ui/router';
import { Calendar } from './ui/screens/Calendar';
import { Data } from './ui/screens/Data';
import { ExerciseInfo } from './ui/screens/ExerciseInfo';
import { ExerciseScreen } from './ui/screens/ExerciseScreen';
import { History } from './ui/screens/History';
import { Home } from './ui/screens/Home';
import { Knee } from './ui/screens/Knee';
import { Library } from './ui/screens/Library';
import { NewExercise } from './ui/screens/NewExercise';
import { Physio } from './ui/screens/Physio';
import { Progress } from './ui/screens/Progress';
import { SessionDetail } from './ui/screens/SessionDetail';
import { SettingsScreen } from './ui/screens/Settings';
import { Summary } from './ui/screens/Summary';
import { TemplateEditor } from './ui/screens/TemplateEditor';
import { Training } from './ui/screens/Training';
import { Workout } from './ui/screens/Workout';
import { RestBar } from './ui/workout-parts';

void start();

type Tab = { route: Route; label: string; icon: IconName; matches: (r: Route) => boolean };

const TABS: Tab[] = [
  { route: { name: 'home' }, label: 'Heute', icon: 'home', matches: (r) => ['home', 'settings', 'data'].includes(r.name) },
  { route: { name: 'training' }, label: 'Training', icon: 'dumbbell', matches: (r) => ['training', 'workout', 'exercise', 'summary', 'template', 'library', 'newExercise'].includes(r.name) || (r.name === 'exerciseInfo' && builtin(r.id)?.category !== 'physio') },
  { route: { name: 'calendar' }, label: 'Kalender', icon: 'calendar', matches: (r) => r.name === 'calendar' },
  { route: { name: 'physio' }, label: 'Physio', icon: 'physio', matches: (r) => r.name === 'physio' || r.name === 'knee' || (r.name === 'exerciseInfo' && builtin(r.id)?.category === 'physio') },
  { route: { name: 'progress' }, label: 'Fortschritt', icon: 'chart', matches: (r) => ['progress', 'history', 'session'].includes(r.name) },
];

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'home': return <Home />;
    case 'training': return <Training />;
    case 'workout': return <Workout />;
    case 'exercise': return <ExerciseScreen id={route.id} />;
    case 'summary': return <Summary id={route.id} />;
    case 'template': return <TemplateEditor id={route.id} />;
    case 'calendar': return <Calendar month={route.month} />;
    case 'physio': return <Physio />;
    case 'knee': return <Knee />;
    case 'library': return <Library />;
    case 'exerciseInfo': return <ExerciseInfo id={route.id} />;
    case 'newExercise': return <NewExercise />;
    case 'progress': return <Progress />;
    case 'history': return <History />;
    case 'session': return <SessionDetail id={route.id} />;
    case 'settings': return <SettingsScreen />;
    case 'data': return <Data />;
  }
}

export function App() {
  const { phase, error, rest } = useAppState();
  const route = useRoute();

  if (phase === 'loading') {
    return <div class="center-screen" aria-busy="true"><div><div class="spinner" /><p class="muted">Daten werden geladen …</p></div></div>;
  }
  if (phase === 'error') {
    return (
      <div class="center-screen">
        <div style={{ maxWidth: '36ch' }}>
          <h1 class="h2">HYROX Trainer kann nicht starten</h1>
          <p class="muted">{error}</p>
          <button class="btn btn-primary" onClick={() => location.reload()}>Erneut versuchen</button>
        </div>
      </div>
    );
  }
  const key = route.name === 'calendar' ? 'calendar' : 'id' in route ? `${route.name}:${route.id}` : route.name;
  return (
    <div class={`app${route.name === 'exercise' ? ' app-focus' : ''}${rest ? ' has-rest' : ''}`}>
      <Screen key={key} route={route} />
      <RestBar />
      {/* Hidden while logging sets: more room, one-handed navigation at the bottom instead. */}
      <nav class="tabbar" aria-label="Hauptnavigation" hidden={route.name === 'exercise'}>
        <div class="tabbar-inner">
          {TABS.map((t) => (
            <a key={t.label} class="tab" href={href(t.route)} aria-current={t.matches(route) ? 'page' : undefined}>
              <Icon name={t.icon} size={24} />
              {t.label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
