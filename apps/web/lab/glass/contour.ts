/**
 * The outline of a distance field as an SVG path (marching squares), for T0/T1's morphs: a glass
 * element is masked by the smooth union of its shapes (an SVG of this path, GLS-4), so a button
 * can swell into a menu and two capsules can fuse with a liquid bridge in every engine that masks
 * a backdrop-filtered layer, without a GPU. Only while the shape moves: a few thousand field
 * samples per frame at a 2.5 px grid.
 */

/** The zero contour of `field` over the box, in coordinates relative to (x0, y0). */
export function contourPath(
  field: (x: number, y: number) => number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  step: number,
): string {
  const cols = Math.ceil(w / step) + 1;
  const rows = Math.ceil(h / step) + 1;
  const v = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) v[j * cols + i] = field(x0 + i * step, y0 + j * step);
  }
  const at = (i: number, j: number) => v[j * cols + i] ?? 1;
  // Edge ids: horizontal edges (i, j)–(i + 1, j) are even, vertical (i, j)–(i, j + 1) odd.
  const hEdge = (i: number, j: number) => (j * cols + i) * 2;
  const vEdge = (i: number, j: number) => (j * cols + i) * 2 + 1;
  const points = new Map<number, [number, number]>();
  const point = (edge: number): [number, number] => {
    const known = points.get(edge);
    if (known) return known;
    const cell = edge >> 1;
    const i = cell % cols;
    const j = Math.floor(cell / cols);
    const a = at(i, j);
    let p: [number, number];
    if ((edge & 1) === 0) {
      const b = at(i + 1, j);
      const t = a / (a - b);
      p = [(i + t) * step, j * step];
    } else {
      const b = at(i, j + 1);
      const t = a / (a - b);
      p = [i * step, (j + t) * step];
    }
    points.set(edge, p);
    return p;
  };
  const links = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    const la = links.get(a);
    if (la) la.push(b);
    else links.set(a, [b]);
    const lb = links.get(b);
    if (lb) lb.push(a);
    else links.set(b, [a]);
  };
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const tl = at(i, j) < 0 ? 1 : 0;
      const tr = at(i + 1, j) < 0 ? 2 : 0;
      const br = at(i + 1, j + 1) < 0 ? 4 : 0;
      const bl = at(i, j + 1) < 0 ? 8 : 0;
      const index = tl | tr | br | bl;
      if (index === 0 || index === 15) continue;
      const top = hEdge(i, j);
      const bottom = hEdge(i, j + 1);
      const left = vEdge(i, j);
      const right = vEdge(i + 1, j);
      switch (index) {
        case 1:
        case 14:
          link(left, top);
          break;
        case 2:
        case 13:
          link(top, right);
          break;
        case 3:
        case 12:
          link(left, right);
          break;
        case 4:
        case 11:
          link(right, bottom);
          break;
        case 6:
        case 9:
          link(top, bottom);
          break;
        case 7:
        case 8:
          link(left, bottom);
          break;
        case 5:
        case 10: {
          const centre = (at(i, j) + at(i + 1, j) + at(i + 1, j + 1) + at(i, j + 1)) / 4;
          const joined = centre < 0 ? index === 5 : index === 10;
          if (joined) {
            link(left, bottom);
            link(top, right);
          } else {
            link(left, top);
            link(right, bottom);
          }
          break;
        }
        default:
          break;
      }
    }
  }
  const seen = new Set<number>();
  const parts: string[] = [];
  for (const start of links.keys()) {
    if (seen.has(start)) continue;
    const loop: number[] = [];
    let previous = -1;
    let current = start;
    while (!seen.has(current)) {
      seen.add(current);
      loop.push(current);
      const next = (links.get(current) ?? []).find((edge) => edge !== previous && !seen.has(edge));
      if (next === undefined) break;
      previous = current;
      current = next;
    }
    if (loop.length < 3) continue;
    parts.push(
      loop
        .map((edge, n) => {
          const [x, y] = point(edge);
          return `${n === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join('') + 'Z',
    );
  }
  return parts.join('');
}
