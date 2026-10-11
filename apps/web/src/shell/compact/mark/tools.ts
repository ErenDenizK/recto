/**
 * The phone's built-in tools (`design/phone-2026-10/README.md` §3; EDN-8), registered when the
 * chunk loads. Pen, Highlight and the Eraser work through the full edition's ink pipeline
 * (`annotations/pen/ink-input.ts`: a finger draws until a stylus is seen, a second finger drops
 * the stroke). Text and Sign are seams for lanes C and D: they arm their mode and nothing more
 * until their lane registers the real spec over these (`registerCompactTool` replaces by id).
 * Edit text shows as "Soon" until WP5, after the hand check on an iPhone: a tile that arms a
 * mode the phone cannot yet serve would read as broken.
 */
import { useAnnotationStore } from '../../../annotations/annotation-store';
import { m } from '../../../i18n';
import { useToolStore } from '../../../viewer/tool-store';
import { highlighterSlot, penToArm } from './ink-presets';
import { HighlightOptions, InkBadge, PenOptions } from './InkOptions';
import { registerCompactTool } from './registry';

registerCompactTool({
  id: 'pen',
  glyph: 'pen',
  label: m.compact_tool_pen,
  place: 'tile',
  order: 10,
  Options: PenOptions,
  Badge: InkBadge,
  arm: () => {
    const tools = useToolStore.getState();
    const annotations = useAnnotationStore.getState();
    tools.setMode('ink');
    const index = penToArm(annotations.pen, tools.lastPen);
    annotations.armPreset(index);
    tools.setLastPen(index);
  },
});

registerCompactTool({
  id: 'highlight',
  glyph: 'highlighter',
  label: m.compact_tool_highlight,
  place: 'tile',
  order: 20,
  Options: HighlightOptions,
  Badge: InkBadge,
  // Lane B adds the selection path (`selection-markup.ts`); the freehand Highlighter snaps to
  // lines already (`pen/highlighter.ts`).
  arm: () => {
    useToolStore.getState().setMode('ink');
    const index = highlighterSlot(useAnnotationStore.getState().pen);
    if (index !== undefined) useAnnotationStore.getState().armPreset(index);
  },
});

registerCompactTool({
  id: 'text',
  glyph: 'textbox',
  label: m.compact_tool_text,
  place: 'tile',
  order: 30,
  hint: m.compact_tool_text_hint,
  // Lane C (WP4): keyboard keep-in-view and the size and colour options.
  arm: () => useToolStore.getState().setMode('text-box'),
});

registerCompactTool({
  id: 'sign',
  glyph: 'signature',
  label: m.compact_tool_sign,
  place: 'tile',
  order: 40,
  // Lane D (WP6): the saved signatures as tiles and "New"; until then the tool arms Select.
});

registerCompactTool({
  id: 'edit-text',
  glyph: 'edit-text',
  label: m.compact_tool_edit_text,
  place: 'tile',
  order: 50,
  soon: true,
});

registerCompactTool({
  id: 'eraser',
  glyph: 'eraser',
  label: m.compact_tool_eraser,
  place: 'quiet',
  order: 10,
  hint: m.compact_tool_eraser_hint,
  arm: () => useToolStore.getState().setMode('eraser'),
});
