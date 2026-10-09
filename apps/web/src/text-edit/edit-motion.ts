/**
 * The paragraph editor's motion (motion-2026-10 viewer.md §6).
 *
 * - `openFrame`: entering the editor, its frame (a hairline of the page's selection blue round
 *   the paragraph) unfolds from the first line to the whole paragraph on `smooth`, fading in on
 *   `--duration-fast`, so the paragraph is seen opening where it was pressed. Under reduced
 *   motion only the fade runs.
 * - `holdOverCommit`: applying an edit, a copy of what the editor shows (the drawn glyphs, or
 *   the dry run's bitmap) stays over the paragraph until the page has painted the edited
 *   bitmap (`whenPainted`), then fades out on `--duration-base`: the new text cross-fades in
 *   over itself instead of the old text flashing back for a render. The copy is removed when
 *   its fade ends (Q-2, Q-10).
 */
import type { SourceId } from '@pdf-editor/document-model';

import { getEngineService } from '../engine/engine-service';
import { animateStyle } from '../motion/animate';
import { duration, EASE } from '../motion/tokens';
import { whenPainted } from '../viewer/read-controller';
import styles from './ParagraphEditor.module.css';

/** Unfolds the editor's `frame` from a first line `lineHeight` px tall (module header). */
export function openFrame(frame: HTMLElement | null, lineHeight: number): void {
  if (!frame || typeof frame.animate !== 'function') return;
  const height = frame.offsetHeight;
  if (height > 0 && lineHeight > 0 && lineHeight < height) {
    animateStyle(frame, 'transform', [0, 0, 1, lineHeight / height], [0, 0, 1, 1], {
      spring: 'smooth',
    });
  }
  frame.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: duration('fast'),
    easing: EASE.out,
  });
}

/**
 * Holds a copy of the editor `root`'s canvases over its page until page `pageIndex` of
 * `source` has painted its edited bitmap, then fades it out (module header).
 */
export function holdOverCommit(root: HTMLElement | null, source: SourceId, pageIndex: number) {
  const page = root?.closest<HTMLElement>('[data-page-id]');
  if (!root || !page) return;
  const box = page.getBoundingClientRect();
  const scale = page.offsetWidth > 0 ? box.width / page.offsetWidth : 1;
  const hold = page.ownerDocument.createElement('div');
  hold.className = styles.hold ?? '';
  hold.dataset.paragraphHold = '';
  hold.setAttribute('aria-hidden', 'true');
  for (const canvas of root.querySelectorAll('canvas')) {
    if (canvas.width === 0 || canvas.height === 0) continue;
    const rect = canvas.getBoundingClientRect();
    const copy = page.ownerDocument.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    try {
      copy.getContext('2d')?.drawImage(canvas, 0, 0);
    } catch {
      continue;
    }
    Object.assign(copy.style, {
      position: 'absolute',
      left: `${(rect.left - box.left) / scale}px`,
      top: `${(rect.top - box.top) / scale}px`,
      width: `${rect.width / scale}px`,
      height: `${rect.height / scale}px`,
    });
    hold.append(copy);
  }
  if (hold.childElementCount === 0) return;
  page.append(hold);
  const generation = getEngineService().pageRevision(source, pageIndex);
  void whenPainted(source, pageIndex, generation).then(() => {
    if (!hold.isConnected || typeof hold.animate !== 'function') {
      hold.remove();
      return;
    }
    const fade = hold.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: duration('base'),
      easing: EASE.out,
      fill: 'forwards',
    });
    fade.onfinish = fade.oncancel = () => hold.remove();
  });
}
