// Minimal stroke icon set (24px grid, currentColor).
const PATHS: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5',
  book: 'M12 6.5C10 5 7 4.5 4 4.8v13.4c3-.3 6 .2 8 1.7 2-1.5 5-2 8-1.7V4.8c-3-.3-6 .2-8 1.7zM12 6.5v13.4',
  journal: 'M6 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H6zM6 3.5v17M9.5 8h5.5M9.5 11.5h5.5',
  apply: 'M12 21s-7-4.4-7-10.2A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7 2.8C19 16.6 12 21 12 21z',
  library: 'M4 20V5M8.5 20V5M13 20 11 5.5M16 5l4.5 14.5M3 20h18',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-1.8 3.1-1.9-.7a7 7 0 0 1-2 1.2l-.3 2h-3.6l-.3-2a7 7 0 0 1-2-1.2l-1.9.7L5.4 14.7 7 13.5a7 7 0 0 1 0-3L5.4 9.3l1.8-3.1 1.9.7a7 7 0 0 1 2-1.2l.3-2h3.6l.3 2a7 7 0 0 1 2 1.2l1.9-.7 1.8 3.1-1.6 1.2a7 7 0 0 1 0 3z',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  down: 'M6 9l6 6 6-6',
  board: 'M12 12m-2.5 0a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0M5 5.5a2 2 0 1 0 0 .1M19 5.5a2 2 0 1 0 0 .1M5 18.5a2 2 0 1 0 0 .1M19 18.5a2 2 0 1 0 0 .1M6.5 7l3.8 3.4M17.5 7l-3.8 3.4M6.5 17l3.8-3.4M17.5 17l-3.8-3.4',
  mic: 'M12 3.5a2.8 2.8 0 0 1 2.8 2.8V12a2.8 2.8 0 0 1-5.6 0V6.3A2.8 2.8 0 0 1 12 3.5zM6 11.5a6 6 0 0 0 12 0M12 17.5V21',
  stop: 'M7 7h10v10H7z',
  play: 'M8 5.5v13l10-6.5z',
  pause: 'M8 5.5v13M16 5.5v13',
  edit: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  video: 'M3.5 6.5h12v11h-12zM15.5 10.5l5-3v9l-5-3',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  greek: 'M7 19V5h10M12 12h4',
  history: 'M4 12a8 8 0 1 0 2.3-5.7M4 4.5v3.8h3.8M12 8v4.3l2.8 1.7',
  download: 'M12 4v11M7 10.5l5 5 5-5M5 19.5h14',
  upload: 'M12 16V5M7 9.5l5-5 5 5M5 19.5h14',
  zoomIn: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20M10.5 8v5M8 10.5h5',
  zoomOut: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20M8 10.5h5',
  fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  quote: 'M6 17c-1.5-1-2-2.6-2-4.5C4 9.5 6 7.5 9 7M15 17c-1.5-1-2-2.6-2-4.5 0-3 2-5 5-5.5M5 13h4v4H5zM14 13h4v4h-4z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  tag: 'M3.5 12.5V4h8.5L20.5 12.5 12 21zM8 8.5h.1',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  menu: 'M4 7h16M4 12h16M4 17h16',
};

export function Icon({ name, size = 20, className }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}
