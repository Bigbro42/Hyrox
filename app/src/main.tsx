import { render } from 'preact';
import { App } from './app';
import './ui/styles.css';

render(<App />, document.getElementById('app')!);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' })
    // Each start checks the offline copy: another app on the same domain may have removed it.
    .then(() => navigator.serviceWorker.ready.then((r) => r.active?.postMessage('ensure-cache')))
    .catch((e) => console.warn('Service worker not registered', e));
}
