import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Ganchos de depuración para la verificación automatizada (sólo en desarrollo).
if (import.meta.env.DEV) {
  void Promise.all([import('./camera/CameraRig'), import('./state/store'), import('./core/simulation/clock'), import('./interaction/selection')]).then(
    ([cam, store, clock, sel]) => {
      (window as unknown as Record<string, unknown>).__del = { cameraApi: cam.cameraApi, useApp: store.useApp, sim: clock.sim, useSelection: sel.useSelection };
    },
  );
}
