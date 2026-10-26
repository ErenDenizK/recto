/**
 * The phone's Text tool (`design/phone-2026-10/README.md` §3 row 2, §4; code-audit §6 WP4),
 * registered over the built-in stub (`tools.ts`): it arms the full edition's text box
 * (`text-box` in `AnnotationLayer`, typed into in `InlineEditors`, which commits on blur and
 * drops an empty box), with three sizes and three colours in the drawer (`TextOptions.tsx`) on
 * the text style the desktop uses, so a phone and a computer type with the same settings.
 *
 * The page layer `TextLayer.tsx` adds what a phone needs: the keyboard opens in the tap that
 * places a box, a tap on a box edits it again, and the box is kept above the keyboard while
 * the island steps away for the keyboard's Done (`keyboard.ts`). The field is laid out at
 * 16 px at least (`setMinFieldFontPx`), so iOS never zooms the page as it takes focus
 * (ux-references §5 row 6); the mark chunk loads only in the compact edition.
 *
 * `Tray` is the single capsule's tray (`TextTray.tsx`, EDN-24): the Edit text switch, then the
 * same `TextOptions`; the drawer keeps `Options`.
 */
import { setMinFieldFontPx } from '../../../annotations/InlineEditors';
import { m } from '../../../i18n';
import { useToolStore } from '../../../viewer/tool-store';
import { registerCompactOverlay } from '../mark-host';
import { registerCompactTool } from './registry';
import { TextLayer } from './TextLayer';
import { FIELD_MIN_PX } from './text-presets';
import { TextOptions } from './TextOptions';
import { TextTray } from './TextTray';

setMinFieldFontPx(FIELD_MIN_PX);

registerCompactTool({
  id: 'text',
  glyph: 'textbox',
  label: m.compact_tool_text,
  place: 'tile',
  order: 30,
  Options: TextOptions,
  Tray: TextTray,
  arm: () => useToolStore.getState().setMode('text-box'),
});

registerCompactOverlay(TextLayer);
