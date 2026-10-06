/**
 * Where the palette's popups rise from (`03-markup` MK-8 §2, MK-9 §7): above the palette's
 * whole glass, in line with the control that opened them. A popup anchored to the control
 * alone would cover the ink strip's row above it, the very controls it goes with.
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
      return new DOMRect(own.x, surface.y, own.width, own.bottom - surface.y);
    },
    get contextElement(): Element | undefined {
      return control() ?? undefined;
    },
  };
}
