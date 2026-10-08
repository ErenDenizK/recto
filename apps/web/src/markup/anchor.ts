/**
 * Where the palette's popups rise from (`03-markup` MK-8 §2, MK-9 §7): above the palette's
 * whole glass, the floating ink strip included (`StripPiece.tsx`), in line with the control that
 * opened them. A popup anchored to the control alone would cover the ink strip above it, the
 * very controls it goes with.
 */

/** A virtual anchor: `control`'s column, from the palette's top edge down to its bottom. */
export function abovePalette(control: () => Element | null | undefined) {
  return {
    getBoundingClientRect: (): DOMRect => {
      const element = control();
      const own = element?.getBoundingClientRect() ?? new DOMRect();
      const surface = (
        element?.closest('[data-capsule]') ?? element?.closest('[data-markup-palette]')
      )?.getBoundingClientRect();
      if (!surface) return own;
      const strip = element?.ownerDocument
        .querySelector('[data-strip-piece]:not([data-leaving])')
        ?.getBoundingClientRect();
      const top = strip && strip.height > 0 ? Math.min(surface.y, strip.y) : surface.y;
      return new DOMRect(own.x, top, own.width, own.bottom - top);
    },
    get contextElement(): Element | undefined {
      return control() ?? undefined;
    },
  };
}
