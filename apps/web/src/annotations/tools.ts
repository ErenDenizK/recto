/**
 * The page tools (spec §2): names, shortcuts, Phosphor glyphs, the Markup palette group that
 * holds each one, and the act each one asks of the change guard (`03-markup` §3, MK-2,
 * MK-4). The text markups (Highlight, Underline, Strikeout, Squiggly) have no place in the
 * palette: the contextual bar of a text selection offers them, and they keep their shortcuts
 * and command palette entries.
 */

import { m } from '../i18n';
import type { Act } from '../state/guard';
import type { IconName } from '../ui/Icon';
import type { PaletteGroup, ToolMode } from '../viewer/tool-store';

export interface ToolDefinition {
  readonly mode: ToolMode;
  readonly title: () => string;
  /** Tooltip when it must say more than the name. */
  readonly tooltip?: () => string;
  readonly shortcut?: string;
  /** Phosphor regular at rest; the fill twin when armed (MK-4 §5). */
  readonly icon: IconName;
  /** Extra command palette keywords. */
  readonly keywords?: readonly string[];
  /**
   * The palette group that holds the tool (MK-2): its one home, shown in the palette, the
   * shortcut overlay and the command palette. None for the text markups.
   */
  readonly group?: PaletteGroup;
  /** Shapes share one choice button with a menu (MK-9). */
  readonly shape?: true;
  /**
   * What the tool's commit asks of the guard (`03-markup` §3, ADR-0030 §2.2): strokes and
   * drags `freehand`, placing clicks `place`, the chosen page image `targeted`, the editor
   * `text`; Select makes nothing.
   */
  readonly act: Act | null;
}

/** Palette order within each group (MK-2); `select` stays first (the fallback). */
export const ANNOTATION_TOOLS: readonly ToolDefinition[] = [
  {
    mode: 'select',
    title: m.tool_select,
    shortcut: 'V',
    icon: 'cursor',
    group: 'select',
    act: null,
  },
  // Draw: the pens and the Highlighter (the pen well, MK-6), the eraser, the lasso.
  { mode: 'ink', title: m.tool_ink, shortcut: 'P', icon: 'pen', group: 'draw', act: 'freehand' },
  // Shift+E: E is Edit text (spec §2.2).
  {
    mode: 'eraser',
    title: m.tool_eraser,
    shortcut: 'Shift+E',
    icon: 'eraser',
    group: 'draw',
    act: 'freehand',
  },
  // The lasso encloses ink and annotations to move, recolour or delete them (spec §6.5).
  {
    mode: 'lasso',
    title: m.lasso_tool,
    tooltip: m.lasso_tool_tooltip,
    shortcut: 'Q',
    icon: 'lasso',
    group: 'draw',
    keywords: ['lasso', 'select', 'strokes'],
    act: 'freehand',
  },
  // Add: shapes (one choice button), text box, note, image, stamp.
  {
    mode: 'rectangle',
    title: m.tool_rectangle,
    shortcut: 'R',
    icon: 'square',
    group: 'add',
    shape: true,
    act: 'freehand',
  },
  {
    mode: 'ellipse',
    title: m.tool_ellipse,
    shortcut: 'O',
    icon: 'circle',
    group: 'add',
    shape: true,
    act: 'freehand',
  },
  {
    mode: 'line',
    title: m.tool_line,
    shortcut: 'L',
    icon: 'line-segment',
    group: 'add',
    shape: true,
    act: 'freehand',
  },
  {
    mode: 'arrow',
    title: m.tool_arrow,
    shortcut: 'A',
    icon: 'arrow-up-right',
    group: 'add',
    shape: true,
    act: 'freehand',
  },
  {
    mode: 'text-box',
    title: m.tool_text_box,
    shortcut: 'T',
    icon: 'textbox',
    group: 'add',
    act: 'place',
  },
  { mode: 'note', title: m.tool_note, shortcut: 'N', icon: 'note', group: 'add', act: 'place' },
  {
    mode: 'image',
    title: m.tool_image,
    tooltip: m.tool_image_tooltip,
    shortcut: 'I',
    icon: 'image',
    group: 'add',
    keywords: ['image', 'picture', 'photo', 'move', 'resize', 'replace', 'extract', 'logo'],
    act: 'targeted',
  },
  // Shift+I: I is the Image tool (M4 §3).
  {
    mode: 'stamp',
    title: m.tool_stamp,
    shortcut: 'Shift+I',
    icon: 'stamp',
    group: 'add',
    act: 'place',
  },
  // Fill & sign: the saved signatures (MK-12); the field tools are commands (MK-14).
  {
    mode: 'signature',
    title: m.tool_signature,
    tooltip: m.tool_signature_tooltip,
    shortcut: 'G',
    icon: 'signature',
    group: 'sign',
    act: 'place',
  },
  // Page content: the page's own text, and redaction.
  {
    mode: 'edit-text',
    title: m.tool_edit_text,
    tooltip: m.tool_edit_text_tooltip,
    shortcut: 'E',
    icon: 'edit-text',
    group: 'page',
    keywords: ['edit', 'text', 'replace', 'change', 'typo', 'word', 'font'],
    act: 'text',
  },
  {
    mode: 'redact',
    title: m.tool_redact,
    tooltip: m.tool_redact_tooltip,
    shortcut: 'X',
    icon: 'redact',
    group: 'page',
    act: 'freehand',
  },
  // Text markups: no palette entry (the selection's contextual bar offers them); keys and the
  // command palette arm them. H arms the Highlighter preset instead (craft spec §5.4,
  // `tool.highlighter`), so the Highlight tool has no key.
  { mode: 'highlight', title: m.tool_highlight, icon: 'highlighter', act: 'freehand' },
  {
    mode: 'underline',
    title: m.tool_underline,
    shortcut: 'U',
    icon: 'text-underline',
    act: 'freehand',
  },
  {
    mode: 'strikeout',
    title: m.tool_strikeout,
    shortcut: 'S',
    icon: 'text-strikethrough',
    act: 'freehand',
  },
  { mode: 'squiggly', title: m.tool_squiggly, icon: 'wave-sine', act: 'freehand' },
];

export function toolDefinition(mode: ToolMode): ToolDefinition {
  return ANNOTATION_TOOLS.find((t) => t.mode === mode) ?? (ANNOTATION_TOOLS[0] as ToolDefinition);
}

export const MARKUP_MODES = ['highlight', 'underline', 'strikeout', 'squiggly'] as const;
export type MarkupMode = (typeof MARKUP_MODES)[number];

export function isMarkupMode(mode: ToolMode): mode is MarkupMode {
  return (MARKUP_MODES as readonly string[]).includes(mode);
}

/** The tools of a palette group, in palette order. */
export function toolsOfGroup(group: PaletteGroup): readonly ToolDefinition[] {
  return ANNOTATION_TOOLS.filter((t) => t.group === group);
}

/** The palette group of a tool; none for the text markups. */
export function paletteGroupOfMode(mode: ToolMode): PaletteGroup | undefined {
  return toolDefinition(mode).mode === mode ? toolDefinition(mode).group : undefined;
}
