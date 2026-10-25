/**
 * Outer contour of the edge map (plan bm-scan-plan §2 "Edge detection", step 3). Edge pixels are
 * grouped into components that bridge gaps of up to 2 px (a Canny outline breaks where the page
 * and the desk are close in tone); each component's outer contour is its convex hull, which is all
 * a page quad needs and is robust to the broken outline.
 */

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** The item at `i`, which the caller knows exists (`noUncheckedIndexedAccess` cannot see it). */
export function at<T>(items: readonly T[], i: number): T {
  const item = items[i];
  if (item === undefined) throw new RangeError(`index ${i} of ${items.length}`);
  return item;
}

/** The largest components kept: a page outline is a handful of pieces, never dozens. */
const MAX_COMPONENTS = 6;

/**
 * The largest edge-pixel components (at most six, each of at least `minPixels`), biggest first,
 * as pixel positions.
 */
export function edgeComponents(
  edges: Uint8Array,
  width: number,
  height: number,
  minPixels: number,
): Pt[][] {
  const seen = new Uint8Array(edges.length);
  const found: number[][] = [];
  for (let start = 0; start < edges.length; start++) {
    if (!edges[start] || seen[start]) continue;
    const members: number[] = [];
    const stack = [start];
    seen[start] = 1;
    for (let i = stack.pop(); i !== undefined; i = stack.pop()) {
      const x = i % width;
      const y = (i - x) / width;
      members.push(i);
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          const j = yy * width + xx;
          if (edges[j] && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    if (members.length >= minPixels) found.push(members);
  }
  found.sort((a, b) => b.length - a.length);
  return found
    .slice(0, MAX_COMPONENTS)
    .map((members) => members.map((i) => ({ x: i % width, y: Math.floor(i / width) })));
}

/** Convex hull (Andrew's monotone chain), clockwise on screen (y down). */
export function convexHull(points: readonly Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const turn = (chain: Pt[], q: Pt) => {
    const a = chain[chain.length - 2];
    const b = chain[chain.length - 1];
    return (
      a !== undefined &&
      b !== undefined &&
      (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x) <= 0
    );
  };
  const lower: Pt[] = [];
  for (const q of p) {
    while (turn(lower, q)) lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (const q of p.reverse()) {
    while (turn(upper, q)) upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}
