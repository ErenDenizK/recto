/**
 * The phone's tool registry (`design/phone-2026-10/README.md` §3; code-audit §6 lanes B, C, D):
 * what each tool of the drawer is, so a lane adds its tool's behaviour and options without
 * editing the island, the drawer or the bridge.
 *
 *   registerCompactTool({
 *     id: 'sign',
 *     glyph: 'signature',
 *     label: m.compact_tool_sign,
 *     place: 'tile',
 *     order: 40,
 *     Options: SavedSignatures,         // the drawer's second row while Sign is armed
 *     arm: (doc) => armSignature(doc),  // Markup is open on `doc` when this runs
 *     disarm: () => clearPending(),
 *   });
 *
 * - A registration replaces the one with the same id (the built-in stubs, `tools.ts`), and its
 *   disposer puts the replaced one back.
 * - `place`: `tile` is the first row (Pen, Highlight, Text, Sign, Edit text, by `order`);
 *   `quiet` is the third (Eraser), beside the bridge's own Redo and Select.
 * - `arm` runs after the previous tool's `disarm`, with Markup open on the document (the one
 *   gate, code-audit §2): set the tool store's mode, arm a preset, open a sheet. A tool that
 *   leaves `arm` out arms Select, so its presses fall through to the page.
 * - `soon`: the tile shows, reads "Soon" and does not arm (Edit text's stub, until
 *   `edit-text.tsx` registers over it, EDN-17).
 * - A tile arms its tool and the drawer stays open (EDN-18); whether a press outside then goes on
 *   to the page follows the mode `arm` set (`drawer-close.ts`), so a tool needs no flag for it.
 * - `Options` renders in the drawer's second row while the tool is armed; `hint` is a one-line
 *   fallback there for a tool with no options. `Badge` draws over the chip's glyph (the pen's
 *   ink dot), keyed by tool, so it may use hooks.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { type ComponentType, useSyncExternalStore } from 'react';

import type { IconName } from '../../../ui/Icon';
import type { CompactTool } from '../compact-store';

export interface CompactToolSpec {
  readonly id: CompactTool;
  readonly glyph: IconName;
  /** One word: the chip's label and the tile's. */
  readonly label: () => string;
  /** The drawer row it shows in. */
  readonly place: 'tile' | 'quiet';
  /** Order within its row, ascending. */
  readonly order: number;
  /** Shown but not armable yet; the tile reads "Soon". */
  readonly soon?: boolean;
  /** The drawer's second row while this tool is armed. */
  readonly Options?: ComponentType;
  /**
   * The single capsule's tray content while this tool is armed (EDN-24, Labs `phone-capsule`);
   * the tray falls back to `Options`. Unused while the switch is off.
   */
  readonly Tray?: ComponentType;
  /** The second row's one line when the tool has no options. */
  readonly hint?: () => string;
  /** Drawn over the chip's glyph while armed (the ink's colour). */
  readonly Badge?: ComponentType;
  /** Arms the tool's behaviour; Markup is open on `doc`. */
  readonly arm?: (doc: DocumentId) => void;
  /** Undoes what `arm` set beyond the tool store's mode. */
  readonly disarm?: () => void;
}

let specs: ReadonlyMap<CompactTool, CompactToolSpec> = new Map();
const listeners = new Set<() => void>();

function publish(next: Map<CompactTool, CompactToolSpec>): void {
  specs = next;
  for (const listener of listeners) listener();
}

/** Adds `spec`, replacing the one with its id; the disposer restores what it replaced. */
export function registerCompactTool(spec: CompactToolSpec): () => void {
  const replaced = specs.get(spec.id);
  publish(new Map(specs).set(spec.id, spec));
  return () => {
    if (specs.get(spec.id) !== spec) return;
    const next = new Map(specs);
    if (replaced) next.set(spec.id, replaced);
    else next.delete(spec.id);
    publish(next);
  };
}

/** The spec of `tool`, if one is registered. */
export function compactTool(tool: CompactTool | null): CompactToolSpec | undefined {
  return tool === null ? undefined : specs.get(tool);
}

/** The tools of a row, in order. */
export function toolsIn(
  place: CompactToolSpec['place'],
  from: ReadonlyMap<CompactTool, CompactToolSpec> = specs,
): CompactToolSpec[] {
  return [...from.values()].filter((s) => s.place === place).sort((a, b) => a.order - b.order);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => specs;

/** Every registered tool, followed. */
export function useCompactTools(): ReadonlyMap<CompactTool, CompactToolSpec> {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Tests: forget every registration. */
export function resetCompactTools(): void {
  publish(new Map());
}
