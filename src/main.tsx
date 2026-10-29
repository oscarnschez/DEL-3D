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
  void Promise.all([
    import('./camera/CameraRig'),
    import('./state/store'),
    import('./core/simulation/clock'),
    import('./interaction/selection'),
    import('./state/settings'),
    import('./render/resources'),
  ]).then(([cam, store, clock, sel, settings, res]) => {
    (window as unknown as Record<string, unknown>).__del = {
      cameraApi: cam.cameraApi,
      useApp: store.useApp,
      sim: clock.sim,
      clock,
      useSelection: sel.useSelection,
      useSettings: settings.useSettings,
      disposalStats: res.disposalStats,
    };
  });
}
