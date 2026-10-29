import type { SVGProps } from 'react';

/** Iconos de trazo (24×24, currentColor). Dibujados para la interfaz; sin dependencias externas. */
const PATHS = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  panel: 'M4 5h16v14H4zM15 5v14',
  play: 'M7 5l12 7-12 7z',
  stop: 'M6 6h12v12H6z',
  pause: 'M8 5v14M16 5v14',
  stepBack: 'M18 6l-8 6 8 6zM7 6v12',
  stepFwd: 'M6 6l8 6-8 6zM17 6v12',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4z',
  fullscreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  reset: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5',
  compare: 'M4 7h13l-3-3M20 17H7l3 3',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
  film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z',
  close: 'M6 6l12 12M18 6L6 18',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  ghost: 'M12 3a7 7 0 0 0-7 7v11l2.5-2 2.3 2 2.2-2 2.2 2 2.3-2 2.5 2V10a7 7 0 0 0-7-7z',
  focus: 'M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4M12 12h.01',
  isolate: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  cut: 'M4 20L20 4M7 4h13v13',
  explode: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8',
  thermo: 'M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0zM12 9v7',
  gauge: 'M4 18a8 8 0 1 1 16 0M12 18l4-6',
  camera: 'M4 7h3l2-2h6l2 2h3v12H4zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  check: 'M5 12l5 5 9-10',
  warn: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01',
  slow: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Marca del laboratorio: sección de cilindro con pistón y biela, en la paleta de la interfaz. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#202A33" stroke="#36424E" />
      <path d="M9 6v13M23 6v13" stroke="#4DA3D9" strokeWidth="2" strokeLinecap="round" />
      <rect x="11" y="10" width="10" height="7" rx="1.5" fill="#E8EDF2" />
      <path d="M16 15l-3 9" stroke="#37C8D6" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12.6" cy="24.6" r="2.4" fill="none" stroke="#E3A34C" strokeWidth="1.8" />
      <path d="M12.5 4.5l1 2.5M19.5 4.5l-1 2.5" stroke="#E3A34C" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
