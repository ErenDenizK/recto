/**
 * The measured fold of the Markup palette (`03-markup` MK-2 §2, 03.2, 03.9; flows §4.3): pure,
 * so every width class, language and density is a table test.
 *
 * The palette lays out its full row once and measures each item (`MarkupPalette.tsx`); this
 * module then takes steps in a fixed order until the row fits the width it has (the free
 * rectangle less 2 × 16 px). A step either drops an item's label (the item stays, as its
 * glyph) or folds the item into + (More tools), where it stays reachable. The class names
 * only seed the order: nothing here asks which class the window is.
 *
 * The row's width is the sum of its visible items, the gaps between items of one group, a
 * separator between two shown groups, and the row's own padding. A group whose items are all
 * folded takes no separator.
 */

export interface FoldItem {
  readonly id: string;
  /** Items of one group share a separator-free run. */
  readonly group: string;
  /** Measured width with its label (or its only width). */
  readonly width: number;
  /** Measured width without its label; absent when it has none to drop. */
  readonly bareWidth?: number | undefined;
}

export type FoldStep =
  | { readonly kind: 'label'; readonly id: string }
  | { readonly kind: 'fold'; readonly id: string };

export interface FoldMetrics {
  /** Between two items of one group (CSS px). */
  readonly gap: number;
  /** A separator with its margins, between two shown groups (CSS px). */
  readonly separator: number;
  /** The row's padding and border, both ends together (CSS px). */
  readonly padding: number;
}

export interface FoldResult {
  /** Items shown in the row, in row order. */
  readonly visible: readonly string[];
  /** Items folded into +, in row order. */
  readonly folded: readonly string[];
  /** Items shown without their label. */
  readonly bare: ReadonlySet<string>;
  /** The row's width as laid out. */
  readonly width: number;
  /** Whether it fits: false only when every step was taken and it still does not. */
  readonly fits: boolean;
}

/** The row's width with `folded` out and `bare` items unlabelled. */
export function rowWidth(
  items: readonly FoldItem[],
  folded: ReadonlySet<string>,
  bare: ReadonlySet<string>,
  metrics: FoldMetrics,
): number {
  let width = metrics.padding;
  let group: string | null = null;
  let groups = 0;
  for (const item of items) {
    if (folded.has(item.id)) continue;
    if (item.group !== group) {
      if (groups > 0) width += metrics.separator;
      groups += 1;
      group = item.group;
    } else {
      width += metrics.gap;
    }
    width += bare.has(item.id) ? (item.bareWidth ?? item.width) : item.width;
  }
  return width;
}

/**
 * Takes `steps` in order until the row fits `available` (CSS px). Steps naming an item that is
 * not in the row are skipped. Half a pixel of slack absorbs the measuring's rounding.
 */
export function foldPalette(
  items: readonly FoldItem[],
  steps: readonly FoldStep[],
  available: number,
  metrics: FoldMetrics,
): FoldResult {
  const folded = new Set<string>();
  const bare = new Set<string>();
  const ids = new Set(items.map((item) => item.id));
  let width = rowWidth(items, folded, bare, metrics);
  for (const step of steps) {
    if (width <= available + 0.5) break;
    if (!ids.has(step.id) || folded.has(step.id)) continue;
    if (step.kind === 'label') bare.add(step.id);
    else folded.add(step.id);
    width = rowWidth(items, folded, bare, metrics);
  }
  return {
    visible: items.filter((item) => !folded.has(item.id)).map((item) => item.id),
    folded: items.filter((item) => folded.has(item.id)).map((item) => item.id),
    bare,
    width,
    fits: width <= available + 0.5,
  };
}
