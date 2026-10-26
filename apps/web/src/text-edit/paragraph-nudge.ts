/**
 * The keyboard nudge of a focused, unopened paragraph target (TXT-24, behind the Labs toggle):
 * Arrow moves it 1 pt on the screen, Shift+Arrow 10 pt. A burst of presses is one move,
 * committed 600 ms after the last (`commitParagraphMove`: one history entry, "Move paragraph").
 * The move is kept inside the CropBox; a refusal is announced.
 */
import type { ParagraphBlock } from '@pdf-editor/engine';
import type { KeyboardEvent } from 'react';

import type { PageTarget } from '../annotations/annotation-store';
import { announce } from '../shell/announcer';
import type { PageFrame } from '../viewer/geometry';
import { commitParagraphMove } from './actions';
import { clampMove, cropOf, type Delta, nudgeOf } from './frame-drag';
import { paragraphFrameEnabled } from './paragraph-frame-flag';

/** Quiet time after the last press before the move is committed, ms. */
export const NUDGE_IDLE_MS = 600;

interface Burst {
  readonly id: string;
  readonly target: PageTarget;
  readonly block: ParagraphBlock;
  readonly revision: number;
  readonly frame: PageFrame;
  d: Delta;
  timer: ReturnType<typeof setTimeout>;
}

let burst: Burst | null = null;

function flush(): void {
  const done = burst;
  if (!done) return;
  burst = null;
  clearTimeout(done.timer);
  if (done.d.dx === 0 && done.d.dy === 0) return;
  void commitParagraphMove(done.target, done.block, done.revision, done.d).then((outcome) => {
    if (!outcome.ok) announce(outcome.message, { politeness: 'assertive' });
  });
}

/** Handles an Arrow press on a paragraph's keyboard target; true when it took the key. */
export function nudgeParagraph(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>,
  at: {
    readonly target: PageTarget;
    readonly block: ParagraphBlock;
    readonly revision: number;
    readonly frame: PageFrame;
  },
): boolean {
  if (!paragraphFrameEnabled() || event.altKey || event.ctrlKey || event.metaKey) return false;
  const step = nudgeOf(at.frame, event.key, event.shiftKey);
  if (!step) return false;
  const id = `${at.target.source}:${at.target.pageIndex}:${at.block.ref.index}`;
  if (burst && burst.id !== id) flush();
  const current = burst?.d ?? { dx: 0, dy: 0 };
  if (burst) clearTimeout(burst.timer);
  const d = clampMove(at.block.box, cropOf(at.frame), {
    dx: current.dx + step.dx,
    dy: current.dy + step.dy,
  });
  burst = { id, ...at, d, timer: setTimeout(flush, NUDGE_IDLE_MS) };
  return true;
}
