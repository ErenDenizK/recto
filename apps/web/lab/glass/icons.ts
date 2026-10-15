/**
 * The lab's glyphs: plain 24 px stroke paths, enough to read as controls. The app's Phosphor set
 * (ui/icons.generated.tsx) is not imported: the lab shares no module with the app.
 */
const PATHS = {
  back: 'M15 5l-7 7 7 7',
  more: 'M4.6 12a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0M10.6 12a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0M16.6 12a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0',
  pen: 'M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3',
  marker: 'M7 21h10M9 17l-2 4M15 17l2 4M8 17h8l-1-9H9l-1 9zM10 8l1-5h2l1 5',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  sign: 'M3 17c3-6 5-9 7-9s-1 9 1 9 3-4 5-4 2 2 5 2M3 21h18',
  pages: 'M4 5h6v14H4zM14 5h6v6h-6zM14 15h6v4h-6z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  share: 'M12 3v12M8 7l4-4 4 4M5 12v7h14v-7',
  info: 'M12 11v6M12 7.5v.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  select: 'M4 4h4M4 4v4M20 4h-4M20 4v4M4 20h4M4 20v-4M20 20h-4M20 20v-4',
  rotate: 'M4 12a8 8 0 1 0 3-6.2M4 4v4h4',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
  moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  jump: 'M5 12h12M13 6l6 6-6 6',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4',
} as const;

export type Glyph = keyof typeof PATHS;

/** An inline SVG for the glyph (aria-hidden; the control carries its own name). */
export function glyph(name: Glyph): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[name]}"/></svg>`;
}
