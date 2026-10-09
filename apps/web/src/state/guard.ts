/**
 * The change guard (ADR-0030; flows.md §2.5; redesign spec §7): one question replaces "is the
 * document in Edit": may this kind of change happen to this document now?
 *
 * | Act | Covers | Allowed when the document is not locked |
 * |---|---|---|
 * | `targeted` | A change aimed at an object the person chose: type in a field, Highlight a selection, restyle or delete a selected annotation | Always |
 * | `freehand` | The pointer itself creates: pens, Highlighter stroke, shapes, Eraser, lasso move, Redact drag | Only in Markup |
 * | `place` | An object at a point: a note, text, signature, image or stamp; Add field (X34) | With a point the person named ("Add … here", keyboard placement); otherwise only in Markup |
 * | `text` | The paragraph editor commits | Always (its doors are input rules, ADR-0029 §2.3) |
 * | `pages` | Page structure: move, rotate, delete, insert, duplicate, crop | Always |
 * | `document` | Whole-document operations: page numbers, Bates, watermark, OCR, Apply redactions, metadata, password, rename (X12, X31) | Always |
 *
 * It fails closed: an unknown document, an unknown act, and any act on a locked document are
 * refused. The refusal says why (`changeRefusal`), so menus, bars and ⌘K dim what cannot run
 * and show the reason instead of hiding it (RA-21; `refusalReason`). Undo, Redo and History
 * jumps never ask (ADR-0030 §2.7).
 *
 * Every committing command declares its act in the registry (`commands/registry.ts`), which
 * asks this guard for each document the command changes (ADR-0030 §2.4). Behind it,
 * `workspace-store`'s `commit()` refuses a change to a locked document whatever asked
 * (`lock-check.ts`, D1-3), so a site that forgets the guard still fails closed.
 *
 * Reads the workspace (which documents exist), the Markup flag of `ui-store` and `lock-store`;
 * none of them imports this module.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { m } from '../i18n';
import { type LockReason, useLockStore } from './lock-store';
import { isMarkupOpen, useUiStore } from './ui-store';
import { useWorkspaceStore } from './workspace-store';

/** The kinds of change (ADR-0030 §2.2). */
export type Act = 'targeted' | 'freehand' | 'place' | 'text' | 'pages' | 'document';

export const ACTS: readonly Act[] = ['targeted', 'freehand', 'place', 'text', 'pages', 'document'];

export function isAct(value: unknown): value is Act {
  return (ACTS as readonly unknown[]).includes(value);
}

/** How the asking site reaches the act, where that changes the answer. */
export interface ChangeContext {
  /**
   * The site opens Markup before it acts: a Markup door (ADR-0029 §2.2: dock Markup, Fill &
   * sign, M, 2, a tool key, "Mark area"). `freehand` and `place` then need only an unlocked
   * document.
   */
  readonly opensMarkup?: boolean;
  /** `place` at a point the person named: "Add … here" or keyboard placement (X34). */
  readonly atPoint?: boolean;
}

/** Why a change is refused. */
export type ChangeRefusal =
  /** No such document (or no document), or an act the guard does not know: fails closed. */
  | { readonly kind: 'unknown' }
  /** The document is locked, for `reason` (ADR-0029 §2.4). */
  | { readonly kind: 'locked'; readonly reason: LockReason }
  /** A `freehand` or `place` act outside Markup, from a site that does not open it. */
  | { readonly kind: 'markup'; readonly act: 'freehand' | 'place' };

/** What the guard needs to know about one document. */
export interface DocumentFacts {
  /** The workspace holds the document. */
  readonly known: boolean;
  readonly markup: boolean;
  readonly lock: LockReason | undefined;
}

const UNKNOWN: ChangeRefusal = { kind: 'unknown' };

/** The guard's rule over facts already read: the refusal, or undefined when allowed. */
export function refusalFor(
  facts: DocumentFacts,
  act: Act,
  context: ChangeContext = {},
): ChangeRefusal | undefined {
  if (!facts.known || !isAct(act)) return UNKNOWN;
  if (facts.lock !== undefined) return { kind: 'locked', reason: facts.lock };
  if (facts.markup || context.opensMarkup === true) return undefined;
  if (act === 'freehand') return { kind: 'markup', act };
  if (act === 'place' && context.atPoint !== true) return { kind: 'markup', act };
  return undefined;
}

/** The facts of `id` now. */
export function documentFacts(id: DocumentId | null | undefined): DocumentFacts {
  if (id == null) return { known: false, markup: false, lock: undefined };
  return {
    known: useWorkspaceStore.getState().workspace.documents[id] !== undefined,
    markup: isMarkupOpen(useUiStore.getState(), id),
    lock: useLockStore.getState().locks[id],
  };
}

/** Why `act` may not change `id` now, or undefined when it may. */
export function changeRefusal(
  id: DocumentId | null | undefined,
  act: Act,
  context?: ChangeContext,
): ChangeRefusal | undefined {
  return refusalFor(documentFacts(id), act, context);
}

/** May `act` change `id` now? False for an unknown document or act, and while locked. */
export function canChange(
  id: DocumentId | null | undefined,
  act: Act,
  context?: ChangeContext,
): boolean {
  return changeRefusal(id, act, context) === undefined;
}

/** `changeRefusal` for components: follows the workspace, Markup and the lock. */
export function useChangeRefusal(
  id: DocumentId | null | undefined,
  act: Act,
  context?: ChangeContext,
): ChangeRefusal | undefined {
  const known = useWorkspaceStore((s) => id != null && s.workspace.documents[id] !== undefined);
  const markup = useUiStore((s) => isMarkupOpen(s, id));
  const lock = useLockStore((s) => (id == null ? undefined : s.locks[id]));
  return refusalFor({ known, markup, lock }, act, context);
}

/** `canChange` for components. */
export function useCanChange(
  id: DocumentId | null | undefined,
  act: Act,
  context?: ChangeContext,
): boolean {
  return useChangeRefusal(id, act, context) === undefined;
}

/**
 * The short reason a dimmed item shows (04-context §12.5: ≤ 32 characters EN): "Locked ·
 * unlock first" for every lock reason (the Unlock popover, D1-4, says which), "Open Markup to
 * draw" or "… to place" outside Markup, "No document open" when there is none.
 */
export function refusalReason(refusal: ChangeRefusal): string {
  switch (refusal.kind) {
    case 'locked':
      return m.guard_locked();
    case 'markup':
      return refusal.act === 'freehand' ? m.guard_open_markup_draw() : m.guard_open_markup_place();
    case 'unknown':
      return m.guard_no_document();
  }
}
