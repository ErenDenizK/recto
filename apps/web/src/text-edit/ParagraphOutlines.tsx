/**
 * Paragraph outlines (TXT-25): while Edit text is armed, each paragraph target of the page
 * shows a 1 px `--select-wash` hairline at `--radius-page`, no fill; the paragraph under the
 * pointer or holding the keyboard focus shows `--select`. The set is the layer's paragraph
 * items (`keyboardPlan`, craft spec §9), so outlines and Tab stops always agree; the open
 * paragraph has none (its editor frame is the control, TXT-24). They fade in in reading order
 * over `FADE_MS` in all (instant under reduced motion). Above `OUTLINE_CAP` paragraphs only the
 * hovered or focused one is drawn. Full edition only in v1, and off with the setting or
 * without the Labs gate (`paragraph-outlines-flag.ts`).
 *
 * The outlines take no pointer. Hover and focus are read from the layer they sit in: a run
 * target under the pointer names its paragraph, a focused paragraph target names itself.
 */
import { useEffect, useRef, useState } from 'react';

import { type PageFrame, rectToCss } from '../annotations/geometry';
import { reducedMotion } from '../motion/reduced-motion';
import { getEdition } from '../shell/frame/edition';

import { runKey } from './model';
import { useOutlineSetting } from './outline-setting';
import { paragraphOutlinesEnabled } from './paragraph-outlines-flag';
import styles from './TextEdit.module.css';
import type { KeyboardItem } from './TextEditLayer';

/** Most boxes drawn at once; above it only the hovered or focused paragraph shows. */
export const OUTLINE_CAP = 250;
/** The fade-in over all the boxes together, ms (TXT-25). */
export const FADE_MS = 120;
/** The outline sits this far outside the box, CSS px (as the keyboard target's padding). */
const PAD = 2;

/** Whether the outlines may show at all: the Labs gate, the setting, the full edition. */
export function useOutlinesOn(): boolean {
  const setting = useOutlineSetting((s) => s.show);
  return paragraphOutlinesEnabled() && setting && getEdition() === 'full';
}

export function ParagraphOutlines({
  items,
  frame,
  openIndex,
}: {
  readonly items: readonly KeyboardItem[];
  readonly frame: PageFrame;
  /** The `ref.index` of the open paragraph, if one is open on this page. */
  readonly openIndex: number | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  // The `items` index of the hovered and of the focused paragraph.
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);

  useEffect(() => {
    const layer = root.current?.parentElement;
    if (!layer) return;
    const over = (event: Event) => {
      const key =
        event.target instanceof Element
          ? event.target.closest('[data-run-key]')?.getAttribute('data-run-key')
          : null;
      setHover(
        key
          ? items.findIndex(
              (item) =>
                item.kind === 'paragraph' && item.target.runs.some((r) => runKey(r) === key),
            )
          : null,
      );
    };
    const leave = () => setHover(null);
    const focusIn = (event: Event) => {
      const at =
        event.target instanceof Element
          ? event.target.closest('[data-text-paragraph]')?.getAttribute('data-text-paragraph')
          : null;
      setFocus(at === null || at === undefined ? null : Number(at));
    };
    const focusOut = () => setFocus(null);
    layer.addEventListener('pointerover', over);
    layer.addEventListener('pointerleave', leave);
    layer.addEventListener('focusin', focusIn);
    layer.addEventListener('focusout', focusOut);
    return () => {
      layer.removeEventListener('pointerover', over);
      layer.removeEventListener('pointerleave', leave);
      layer.removeEventListener('focusin', focusIn);
      layer.removeEventListener('focusout', focusOut);
    };
  }, [items]);

  const paragraphs = items.flatMap((item, index) =>
    item.kind === 'paragraph' && item.target.block.ref.index !== openIndex
      ? [{ block: item.target.block, index }]
      : [],
  );
  const capped = paragraphs.length > OUTLINE_CAP;
  const shown = capped
    ? paragraphs.filter(({ index }) => index === hover || index === focus)
    : paragraphs;
  const instant = reducedMotion();

  return (
    <div
      ref={root}
      className={styles.outlines}
      data-paragraph-outlines={shown.length}
      aria-hidden="true"
    >
      {shown.map(({ block, index }, order) => {
        const box = rectToCss(frame, block.box);
        const strong = index === hover || index === focus;
        return (
          <span
            key={block.ref.index}
            className={styles.outline}
            data-strong={strong || undefined}
            data-fade={instant || capped ? undefined : ''}
            style={{
              left: box.left - PAD,
              top: box.top - PAD,
              width: box.width + 2 * PAD,
              height: box.height + 2 * PAD,
              ['--outline-delay' as string]: `${(order / shown.length) * (FADE_MS / 2)}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
