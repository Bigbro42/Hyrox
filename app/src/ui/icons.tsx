import type { SVGAttributes } from 'preact';

const paths = {
  home: 'M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z',
  history: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4.5l3 1.8',
  data: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Zm-8 3v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  chevron: 'm9 5 7 7-7 7',
  back: 'm15 5-7 7 7 7',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  info: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  download: 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14',
  upload: 'M12 20V9m0 0-4.5 4.5M12 9l4.5 4.5M5 4h14',
  shield: 'M12 3 5 6v5c0 4.6 3 8.5 7 10 4-1.5 7-5.4 7-10V6z',
  external: 'M14 5h5v5m0-5-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4',
  plus: 'M12 5v14M5 12h14',
  chart: 'M4 20V10m5.3 10V4m5.4 16v-7M20 20V8M3 20.5h18',
  shuffle: 'M16 4h4v4M4 20 20 4M20 16v4h-4M15 15l5 5M4 4l5 5',
  body: 'M12 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 9h12M12 9v5m0 0-3 7m3-7 3 7M8 9l-2 5m10-5 2 5',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  calendar: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8 3v4M16 3v4',
  repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
  minus: 'M5 12h14',
  search: 'm20 20-4.2-4.2M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z',
  dumbbell: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  play: 'M8 5.5v13l10.5-6.5z',
  up: 'm6 15 6-6 6 6',
  down: 'm6 9 6 6 6-6',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  close: 'm6 6 12 12M18 6 6 18',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  physio: 'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z',
  football: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5l3.6 2.6-1.4 4.2H9.8l-1.4-4.2zM12 3v4.5M15.6 10.1l4.9-1.6M14.2 14.3l3 4M9.8 14.3l-3 4M8.4 10.1 3.5 8.5',
  run: 'M13.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM6 21l3.5-6.5L13 17v4M8 10.5 11 7l3.5 3 3.5.5M9.5 14.5 7 13.5',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 1.5M10 2h4',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  bolt: 'M13 3 5 14h6l-1 7 8-11h-6z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  pulse: 'M3 12h4l2-6 4 12 2-6h6',
  install: 'M12 3v12m0 0-4-4m4 4 4-4M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 22, ...rest }: { name: IconName; size?: number } & SVGAttributes<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={1.8} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon" {...rest}>
      <path d={paths[name]} />
    </svg>
  );
}
