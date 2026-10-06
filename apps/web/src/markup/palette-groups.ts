/**
 * The Markup palette's model (`03-markup` MK-2, flows §4.3): its items in row order, the group
 * each belongs to, the order in which they fold into + (MK-10) as the room shrinks, and the
 * rules that keep the palette in step with the tools.
 *
 * - **Row.** Done · Select · Draw (the pen well, Highlighter, Eraser, Lasso) · Add (Shapes ▾,
 *   Text box, Note, Image, Stamp ▾) · Fill & sign (Sign ▾, saved-signature chips, the field
 *   stepper, Add field ▾, Show field outlines) · Page content (Edit text, Redact) · +.
 * - **Fold** (`palette-fold.ts`): labels drop first (Redact, then Edit text), then items fold
 *   in flows' order (Stamp, Image, Add field, Show outlines, Redact, Edit text); the chips move
 *   to the ink strip's row (03.7); Sign loses its label; then Note, Shapes, the stepper and
 *   Lasso fold, and below that the ladder for narrow windows (03.9): Eraser, then the
 *   Highlighter, then Text box and Sign; Done keeps its check alone last of all.
 * - **Placing tools** (stamp, signature) go back to Select once their object is placed, and
 *   what they placed is not left selected (`03-markup` §3). Installed on import, so the rule
 *   holds for keys and the command palette as well as the palette.
 */
import { pageKey, useAnnotationStore } from '../annotations/annotation-store';
import { ANNOTATION_TOOLS } from '../annotations/tools';
import { m } from '../i18n';
import { ONE_SHOT_MODES, type PaletteGroup, useToolStore } from '../viewer/tool-store';
import type { FoldStep } from './palette-fold';

/** Every item the row can hold, in row order. */
export const PALETTE_ITEMS = [
  'done',
  'select',
  'pens',
  'highlighter',
  'eraser',
  'lasso',
  'shapes',
  'text-box',
  'note',
  'image',
  'stamp',
  'sign',
  'chips',
  'stepper',
  'add-field',
  'outlines',
  'edit-text',
  'redact',
  'more',
] as const;
export type PaletteItem = (typeof PALETTE_ITEMS)[number];

/** The run each item belongs to: separators fall between runs. */
export const ITEM_GROUP: Readonly<Record<PaletteItem, PaletteGroup | 'done' | 'more'>> = {
  done: 'done',
  select: 'select',
  pens: 'draw',
  highlighter: 'draw',
  eraser: 'draw',
  lasso: 'draw',
  shapes: 'add',
  'text-box': 'add',
  note: 'add',
  image: 'add',
  stamp: 'add',
  sign: 'sign',
  chips: 'sign',
  stepper: 'sign',
  'add-field': 'sign',
  outlines: 'sign',
  'edit-text': 'page',
  redact: 'page',
  more: 'more',
};

/** The fold order (module header): first steps are taken first. */
export const FOLD_STEPS: readonly FoldStep[] = [
  { kind: 'label', id: 'redact' },
  { kind: 'label', id: 'edit-text' },
  { kind: 'fold', id: 'stamp' },
  { kind: 'fold', id: 'image' },
  { kind: 'fold', id: 'add-field' },
  { kind: 'fold', id: 'outlines' },
  { kind: 'fold', id: 'redact' },
  { kind: 'fold', id: 'edit-text' },
  { kind: 'fold', id: 'chips' },
  { kind: 'label', id: 'sign' },
  { kind: 'fold', id: 'note' },
  { kind: 'fold', id: 'shapes' },
  { kind: 'fold', id: 'stepper' },
  { kind: 'fold', id: 'lasso' },
  // The ladder for narrow windows (03.9).
  { kind: 'fold', id: 'eraser' },
  { kind: 'fold', id: 'highlighter' },
  { kind: 'fold', id: 'text-box' },
  { kind: 'fold', id: 'sign' },
  { kind: 'label', id: 'done' },
];

/** The group names (`role="group"`, the + menu's headings; MK-2 §5). */
export const GROUP_LABEL: Readonly<Record<PaletteGroup, () => string>> = {
  select: m.markup_group_select,
  draw: m.markup_group_draw,
  add: m.markup_group_add,
  sign: m.markup_group_sign,
  page: m.markup_group_page,
};

/** Commands the palette holds besides the tools, by group (for the overlay and ⌘K). */
const COMMAND_GROUPS: Readonly<Record<string, PaletteGroup>> = {
  // The Highlighter is the fourth pen preset (craft spec §5.4).
  'tool.highlighter': 'draw',
  'forms.highlight': 'sign',
  'document.sign': 'sign',
  'stamp.image': 'add',
  'redaction.find': 'page',
};

/** The palette group of a command, when the palette holds it. */
export function paletteGroupOfCommand(id: string): PaletteGroup | undefined {
  if (COMMAND_GROUPS[id] !== undefined) return COMMAND_GROUPS[id];
  if (id.startsWith('tool.')) return ANNOTATION_TOOLS.find((t) => `tool.${t.mode}` === id)?.group;
  if (id.startsWith('stamp.')) return 'add';
  if (id.startsWith('forms.add.')) return 'sign';
  return undefined;
}

/** "Markup: Draw" for a command the palette holds; else undefined. */
export function paletteGroupLabelOfCommand(id: string): string | undefined {
  const group = paletteGroupOfCommand(id);
  return group === undefined ? undefined : GROUP_LABEL[group]();
}

/** Whether the placed selection is new: none of its ids is in the page cache yet. */
function isPlacement(): boolean {
  const { selection, pages } = useAnnotationStore.getState();
  if (!selection) return false;
  const known = pages[pageKey(selection.source, selection.pageIndex)]?.annotations ?? [];
  return selection.ids.every((id) => !known.some((a) => a.id === id));
}

let installed = false;

/** Installs the placing tools' rule once (module header). */
export function installPaletteRules(): void {
  if (installed) return;
  installed = true;
  // A placing tool placed its object (the layer selects what it places): nothing stays
  // selected and Select comes back. A selection of existing annotations (a Review row, Tab)
  // is not a placement and is kept.
  useAnnotationStore.subscribe((state, previous) => {
    if (state.selection === null || state.selection === previous.selection) return;
    if (!ONE_SHOT_MODES.has(useToolStore.getState().mode) || !isPlacement()) return;
    state.select(null);
    useToolStore.getState().finishOneShot();
  });
}

installPaletteRules();
