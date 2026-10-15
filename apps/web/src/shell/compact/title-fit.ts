/**
 * The split top's title cut in its middle (DSN-38): a name too long for the room between the
 * circles keeps its start and its end around one ellipsis ("Serway_Physics…Jewett"), as Files
 * and Finder cut file names, because names that share a start ("Invoice_2026_03",
 * "Invoice_2026_04", "…_final_v2") differ at the end. The accessible name and the file menu keep
 * the name whole (DSN-34).
 *
 * The cut is measured, once per name and width (a resize, a rotation), never per frame: the
 * room is the heading's width less the title's padding, gap and ▾; the text is measured in the
 * title's own font on a 2D canvas.
 */
import { type RefObject, useLayoutEffect, useState } from 'react';

export const ELLIPSIS = '…';

/**
 * The longest `start…end` of `text` whose width (`measure`) fits `room`, keeping about as much
 * of the start as of the end (the start one character more); `text` itself when it fits.
 */
export function middleEllipsis(
  text: string,
  room: number,
  measure: (value: string) => number,
): string {
  if (measure(text) <= room) return text;
  const chars = Array.from(text);
  const cut = (keep: number) => {
    const head = Math.ceil(keep / 2);
    const tail = keep - head;
    return (
      chars.slice(0, head).join('').trimEnd() +
      ELLIPSIS +
      chars
        .slice(chars.length - tail)
        .join('')
        .trimStart()
    );
  };
  let lo = 0;
  let hi = chars.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(cut(mid)) <= room) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? ELLIPSIS : cut(lo);
}

let measurer: CanvasRenderingContext2D | null | undefined;

/** The title's text, cut in its middle to the room `heading` leaves for `text`. */
export function useMiddleTitle(
  text: string,
  heading: RefObject<HTMLElement | null>,
  textEl: RefObject<HTMLElement | null>,
): string {
  const [shown, setShown] = useState(text);
  useLayoutEffect(() => {
    const box = heading.current;
    const span = textEl.current;
    if (!box || !span || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      const trigger = span.parentElement;
      if (!trigger) return;
      const style = getComputedStyle(trigger);
      // The heading's width less the trigger's padding, its gap and its other children (the ▾).
      let room =
        box.clientWidth -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight);
      for (const child of trigger.children) {
        if (child === span) continue;
        room -= child.getBoundingClientRect().width + (Number.parseFloat(style.columnGap) || 0);
      }
      measurer ??= document.createElement('canvas').getContext('2d');
      const context = measurer;
      if (!context) return;
      const font = getComputedStyle(span);
      context.font = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
      const spacing = Number.parseFloat(font.letterSpacing) || 0;
      // One pixel to spare against rounding.
      setShown(
        middleEllipsis(
          text,
          room - 1,
          (value) => context.measureText(value).width + spacing * Array.from(value).length,
        ),
      );
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [text, heading, textEl]);
  return shown;
}
