/**
 * The grouped Markup palette (`?palette=groups`, `palette-variant.ts`; epic R25-7, layout A of
 * `design/markup-groups-2026-10.md`): the row's tools under four labelled groups named for the
 * task, Draw · Comment · Fill & sign · Change page, between Select and +.
 *
 * ```
 * ✓ Done │ ↖ │ ✎ Draw ◉ ● ● ▬ ⌫ ◌ ▭ │ 💬 Comment │ ✑ Fill & sign │ ▤ Change page │ +
 * ```
 *
 * - **One group open**, its tools in place after its name; the others show their name alone.
 *   Pressing a name opens that group, and the capsule morphs to the new row (MK-1, through
 *   `shell/capsule/content-morph.ts`). The door picks the first one (Markup: Draw, so a pen
 *   is still one press, INK-2; Fill & sign: its own group).
 * - **Keys follow**: a tool armed by its key, ⌘K or + opens its group (installed on import, so
 *   it holds for every path that arms a tool). Closing Markup forgets the choice.
 * - **The armed tool's name**: a group holding the armed tool shows that tool's name in place of
 *   its own when the tool's button has none of its own (Draw, Comment). Every name the group can
 *   show is laid out in one grid cell, so the name changes and nothing moves under the hand.
 * - **Fold** (`palette-fold.ts`): the closed groups' names drop first (Change page, Fill & sign,
 *   Comment, Draw), then Done's, then today's steps for the open group's tools, then its name.
 */
import { useSyncExternalStore } from 'react';

import { useAnnotationStore } from '../annotations/annotation-store';
import { isHighlighter } from '../annotations/pen/presets';
import { toolDefinition } from '../annotations/tools';
import { m } from '../i18n';
import { setContentMorphKey } from '../shell/capsule/content-morph';
import { isMarkupOpen, type PaletteSet, useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import type { IconName } from '../ui/Icon';
import { SHAPE_MODES, type ToolMode, useToolStore } from '../viewer/tool-store';
import { itemOfMode } from './MoreTools';
import type { FoldStep } from './palette-fold';
import { FOLD_STEPS, type PaletteItem } from './palette-groups';
import { paletteVariant } from './palette-variant';

export const TASK_GROUPS = ['draw', 'comment', 'sign', 'change'] as const;
export type TaskGroup = (typeof TASK_GROUPS)[number];

/** A group's name in the row (its `data-item`, measured by the fold). */
export type GroupHeader = `group-${TaskGroup}`;
export const headerOf = (group: TaskGroup): GroupHeader => `group-${group}`;

/** Each group's tools, in row order. */
export const TASK_ITEMS: Readonly<Record<TaskGroup, readonly PaletteItem[]>> = {
  draw: ['pens', 'highlighter', 'eraser', 'lasso', 'shapes'],
  comment: ['note', 'text-box', 'stamp', 'image'],
  sign: ['sign', 'chips', 'stepper', 'add-field', 'outlines'],
  change: ['edit-text', 'redact'],
};

export const TASK_LABEL: Readonly<Record<TaskGroup, () => string>> = {
  draw: m.markup_group_draw,
  comment: m.markup_task_comment,
  // One task, one name: the group the Fill & sign door opens is named as the door.
  sign: m.dock_fill_sign,
  change: m.markup_task_change,
};

export const TASK_ICON: Readonly<Record<TaskGroup, IconName>> = {
  draw: 'pencil-simple',
  comment: 'chat-centered-text',
  sign: 'signature',
  change: 'file-text',
};

/** The group an item of the row belongs to, if any (Done, Select and + stand alone). */
export function taskOfItem(item: PaletteItem): TaskGroup | undefined {
  return TASK_GROUPS.find((group) => TASK_ITEMS[group].includes(item));
}

/** The modes whose name a group's label shows when armed (tools without a label of their own). */
const NAMED_MODES: Readonly<Record<TaskGroup, readonly ToolMode[]>> = {
  draw: ['ink', 'eraser', 'lasso', ...SHAPE_MODES],
  comment: ['note', 'text-box', 'stamp', 'image'],
  sign: [],
  change: [],
};

/** The name of an armed tool as its group shows it ("Pen", "Eraser", "Note"). */
function modeName(mode: ToolMode, highlighter: boolean): string {
  return mode === 'ink' && highlighter ? m.tool_highlighter() : toolDefinition(mode).title();
}

/** Every name `group`'s label can show while open: its own, then its tools' (one cell). */
export function groupNames(group: TaskGroup): readonly string[] {
  const names = NAMED_MODES[group].map((mode) => modeName(mode, false));
  return [TASK_LABEL[group](), ...new Set(names)];
}

/** The armed tool's name when `group` holds it and shows it (module header), else undefined. */
export function armedName(
  group: TaskGroup,
  mode: ToolMode,
  highlighter: boolean,
): string | undefined {
  // The highlighter's own swatch says what it is, and its long name would widen Draw's slot at
  // rest: Draw keeps its name while it is armed.
  if (mode === 'ink' && highlighter) return undefined;
  return NAMED_MODES[group].includes(mode) ? modeName(mode, highlighter) : undefined;
}

/** The group the door opens on (module header). */
export function doorGroup(door: PaletteSet): TaskGroup {
  return door === 'sign' ? 'sign' : 'draw';
}

/** The group a mode lives in, if one does (Select does not). */
export function taskOfMode(mode: ToolMode, highlighter: boolean): TaskGroup | undefined {
  const item = itemOfMode(mode, highlighter);
  return item === null ? undefined : taskOfItem(item);
}

/** The fold's steps with `open` showing its tools (module header). */
export function groupFoldSteps(open: TaskGroup): readonly FoldStep[] {
  const closed = [...TASK_GROUPS].reverse().filter((group) => group !== open);
  return [
    ...closed.map((group): FoldStep => ({ kind: 'label', id: headerOf(group) })),
    { kind: 'label', id: 'done' },
    ...FOLD_STEPS,
    { kind: 'label', id: headerOf(open) },
  ];
}

// --- The open group -------------------------------------------------------------------

/** The group chosen since Markup opened (a press on its name, or a tool armed); null: the door's. */
let chosen: TaskGroup | null = null;
const listeners = new Set<() => void>();

function choose(next: TaskGroup | null): void {
  if (chosen === next) return;
  chosen = next;
  // The same update as the row's: the capsule morphs to the new row (content-morph.ts).
  setContentMorphKey('palette', next ?? undefined);
  for (const listener of listeners) listener();
}

/** Opens `group` in place (a press on its name). */
export function openTaskGroup(group: TaskGroup): void {
  choose(group);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The open group for the palette's `door`. */
export function useOpenGroup(door: PaletteSet): TaskGroup {
  const value = useSyncExternalStore(
    subscribe,
    () => chosen,
    () => chosen,
  );
  return value ?? doorGroup(door);
}

const armedHighlighter = () => {
  const { pen } = useAnnotationStore.getState();
  return isHighlighter(pen.presets[pen.active]);
};

let installed = false;

/** Installs the rules of the module header once, for the grouped palette only. */
export function installTaskGroupRules(): void {
  if (installed || paletteVariant() !== 'groups') return;
  installed = true;
  // A tool armed by any path opens its group.
  useToolStore.subscribe((state, previous) => {
    if (state.mode === previous.mode) return;
    const group = taskOfMode(state.mode, armedHighlighter());
    if (group !== undefined) choose(group);
  });
  // Markup closed on the active document: the next opening starts at its door's group.
  useUiStore.subscribe((state) => {
    const id = useWorkspaceStore.getState().workspace.activeDocument;
    if (!isMarkupOpen(state, id)) choose(null);
  });
}

installTaskGroupRules();
