/**
 * Glass pieces: one element per control, carrying every tier's layers (the stage's `data-tier`
 * shows one set), the T0 recipe written as literal rules, the T1 lens, and the drag and squish.
 *
 * T0, CSS only (every engine), four layers over one element, each reading the real backdrop
 * (siblings, never nested, so no layer is another's backdrop root, Q-3):
 * - **body**: the tier's blur · saturate · brightness and tint (the same values as
 *   materials.css, so the contrast proofs hold), the dark outer edge and the drop shadow;
 * - **bezel**: a band inside the rim, soft on its inner side (an SVG mask, blurred stroke),
 *   with half the blur and a brighter, more saturated filter: the thick edge that catches light;
 * - **rim**: a hairline whose conic gradient is bright where it faces the light and, weaker, on
 *   the far side (the two specular lobes of Liquid DOM's shader, MIT);
 * - **glow**: the press light at the pointer.
 */
import { glyph, type Glyph } from './icons';
import { addTask, type Task } from './loop';
import { Spring } from './spring';
import { depth, IOR, MAX_PULL, state, type Tier } from './state';
import { chromiumBackdropLens, currentChipLens, lensFilter } from './t1-lens';

export type Kind = 'chip' | 'bar' | 'capsule' | 'menu' | 'round';

/** materials.css classes per kind, as the app composes them. */
const CURRENT: Record<Kind, string> = {
  chip: 'mat mat-chip s7',
  bar: 'mat mat-bar s9',
  capsule: 'mat mat-bar s10',
  menu: 'mat mat-menu s12',
  round: 'mat mat-chip s7',
};

/** A kind's σ as a share of the bar's (the app: chip 7, bar 9, capsule 10, menu 12–16). */
export const KIND_SIGMA: Record<Kind, number> = {
  chip: 0.8,
  bar: 1,
  capsule: 1.1,
  menu: 1.7,
  round: 0.8,
};

/** The tier tokens (tokens.css): tint RGB and alpha per theme, and the filter recipe. */
const TINT = {
  dark: { chip: [30, 32, 37, 0.5], bar: [32, 34, 39, 0.55], menu: [34, 36, 42, 0.78] },
  light: { chip: [250, 250, 252, 0.69], bar: [250, 250, 252, 0.69], menu: [250, 250, 252, 0.78] },
} as const;
const FILTER = {
  dark: { chip: [1.9, 1, 0.42], bar: [1.8, 1, 0.44], menu: [1.6, 1, 0.49] },
  light: { chip: [1.5, 0.45, 1.4], bar: [1.5, 0.45, 1.4], menu: [1.4, 0.45, 1.4] },
} as const;

export function tierOf(kind: Kind): 'chip' | 'bar' | 'menu' {
  return kind === 'menu' ? 'menu' : kind === 'bar' || kind === 'capsule' ? 'bar' : 'chip';
}

/** The look a piece takes: the theme's, or (adaptive) the one its backdrop asks for. */
export type Look = 'dark' | 'light';

export function tintOf(kind: Kind, look: Look = state.theme): [number, number, number, number] {
  const [r, g, b, a] = TINT[look][tierOf(kind)];
  return [r, g, b, Math.min(1, a * state.tint)];
}

export function filterOf(
  kind: Kind,
  look: Look = state.theme,
): { sat: number; contrast: number; bright: number } {
  const [sat, contrast, bright] = FILTER[look][tierOf(kind)];
  return { sat, contrast, bright };
}

/** The literal `backdrop-filter` of a layer (no `var()`: Safari drops those, G-22). */
export function filterString(
  kind: Kind,
  sigma: number,
  boost = 1,
  look: Look = state.theme,
): string {
  const { sat, contrast, bright } = filterOf(kind, look);
  const c = contrast === 1 ? '' : ` contrast(${contrast})`;
  const lift = look === 'dark' ? bright * boost : Math.min(1.6, bright * (1 + (boost - 1) / 4));
  return `blur(${sigma.toFixed(1)}px) saturate(${(sat * (boost > 1 ? 1.15 : 1)).toFixed(2)})${c} brightness(${lift.toFixed(3)})`;
}

let sheet: HTMLStyleElement | undefined;

/** Writes the T0 recipe for the current settings as literal rules, one per kind. */
export function writeT0(): void {
  sheet ??= document.head.appendChild(document.createElement('style'));
  const dark = state.theme === 'dark';
  const rules: string[] = [];
  const kinds: Kind[] = ['chip', 'bar', 'capsule', 'menu', 'round'];
  const refr = Math.min(1, state.refraction);
  for (const kind of kinds) {
    const sigma = state.blur * KIND_SIGMA[kind];
    const [r, g, b, a] = tintOf(kind);
    const body = filterString(kind, sigma);
    const bezel = filterString(kind, Math.max(0, sigma * 0.45), 1.28);
    const edge = dark ? 'rgb(0 0 0 / 0.5)' : 'rgb(15 17 22 / 0.14)';
    const lift = (0.14 * state.spec).toFixed(3);
    const shadow = state.shadow
      ? dark
        ? `0 10px 28px rgb(0 0 0 / 0.32), 0 2px 6px rgb(0 0 0 / 0.22)`
        : `0 10px 28px rgb(20 24 32 / 0.14), 0 2px 6px rgb(20 24 32 / 0.08)`
      : '0 0 #0000';
    rules.push(
      `.stage [data-kind='${kind}'] > .lq-body, .stage .union[data-kind='${kind}'] > .lq-body {` +
        `-webkit-backdrop-filter: ${body}; backdrop-filter: ${body};` +
        `background: rgb(${r} ${g} ${b} / ${a.toFixed(3)});` +
        `box-shadow: 0 0 0 0.5px ${edge}, inset 0 1px 0 rgb(255 255 255 / ${lift}), inset 0 -1px 0 rgb(255 255 255 / ${(0.05 * state.spec).toFixed(3)}), ${shadow}; }`,
      // The adaptive look's other recipe, for pieces whose backdrop asks for it.
      ...(['dark', 'light'] as const)
        .filter((look) => look !== state.theme)
        .map((look) => {
          const [lr, lg, lb, la] = tintOf(kind, look);
          const f = filterString(kind, sigma, 1, look);
          const fb = filterString(kind, Math.max(0, sigma * 0.45), 1.28, look);
          return (
            `.stage [data-kind='${kind}'][data-look='${look}'] > .lq-body {` +
            `-webkit-backdrop-filter: ${f}; backdrop-filter: ${f};` +
            `background: rgb(${lr} ${lg} ${lb} / ${la.toFixed(3)}); }` +
            `.stage [data-kind='${kind}'][data-look='${look}'] > .lq-bezel {` +
            `-webkit-backdrop-filter: ${fb}; backdrop-filter: ${fb}; }`
          );
        }),
      `.stage [data-kind='${kind}'] > .lq-bezel {` +
        `-webkit-backdrop-filter: ${bezel}; backdrop-filter: ${bezel};` +
        `background: linear-gradient(180deg, rgb(255 255 255 / ${(0.16 * refr).toFixed(3)}), rgb(255 255 255 / 0) 45%, rgb(255 255 255 / ${(0.07 * refr).toFixed(3)}));` +
        `opacity: ${refr.toFixed(2)}; }`,
    );
  }
  const a1 = state.spec;
  const a2 = state.spec * 0.55;
  const base = dark ? 0.1 : 0.5;
  const hi = dark ? '255 255 255' : '255 255 255';
  rules.push(
    `.stage .piece > .lq-rim { background: conic-gradient(from ${state.light}deg,` +
      ` rgb(${hi} / ${a1.toFixed(2)}) 0deg, rgb(${hi} / ${base * a1}) 55deg, rgb(${hi} / ${base * a1}) 125deg,` +
      ` rgb(${hi} / ${a2.toFixed(2)}) 180deg, rgb(${hi} / ${base * a1}) 235deg, rgb(${hi} / ${base * a1}) 305deg,` +
      ` rgb(${hi} / ${a1.toFixed(2)}) 360deg); }`,
  );
  sheet.textContent = rules.join('\n');
}

/** The bezel band's mask: the rim stroked at twice the bezel, blurred, inside the box. */
function bezelMask(w: number, h: number, r: number, bezel: number): string {
  const b = Math.max(1, Math.min(bezel, w / 2, h / 2));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(b * 0.35).toFixed(1)}"/></filter>` +
    `<rect width="${w}" height="${h}" rx="${Math.min(r, w / 2, h / 2)}" fill="none" stroke="#fff" stroke-width="${2 * b}" filter="url(#f)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export interface PieceSpec {
  readonly kind: Kind;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Corner radius, px (999 for a capsule). */
  readonly r?: number;
  readonly html: string;
  /** Pieces that do not drag (the morph's, the phone's). */
  readonly fixed?: boolean;
}

export interface Piece {
  readonly el: HTMLElement;
  readonly spec: PieceSpec;
  /** Re-applies the size-bound parts (bezel mask, lenses) after a size or tier change. */
  refresh(): void;
}

const pieces = new Set<Piece>();

export function allPieces(): Piece[] {
  return [...pieces];
}

export function createPiece(spec: PieceSpec, onMove?: () => void): Piece {
  const el = document.createElement('div');
  el.className = 'piece';
  el.dataset.kind = spec.kind;
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', spec.label);
  el.style.left = `${spec.x}px`;
  el.style.top = `${spec.y}px`;
  el.style.width = `${spec.w}px`;
  el.style.height = `${spec.h}px`;
  el.style.borderRadius = `${spec.r ?? 999}px`;
  const layer = (cls: string) => {
    const node = document.createElement('div');
    node.className = `layer ${cls}`;
    el.append(node);
    return node;
  };
  const cur = layer(`cur ${CURRENT[spec.kind]}`);
  layer('lq-body');
  const bezel = layer('lq-bezel');
  layer('lq-rim');
  const glow = layer('lq-glow');
  const content = document.createElement('div');
  content.className = 'content';
  content.innerHTML = spec.html;
  el.append(content);

  const refresh = () => {
    const w = Math.round(el.offsetWidth);
    const h = Math.round(el.offsetHeight);
    if (w === 0 || h === 0) return;
    const r = Math.min(spec.r ?? 999, w / 2, h / 2);
    const mask = bezelMask(w, h, r, state.bezel);
    bezel.style.setProperty('-webkit-mask-image', mask);
    bezel.style.setProperty('mask-image', mask);
    applyLens(el, spec.kind, w, h, r, cur);
  };
  const piece: Piece = { el, spec, refresh };
  pieces.add(piece);
  if (!spec.fixed) attachDrag(el, glow, onMove);
  else attachPress(el, glow);
  return piece;
}

/** T1 on the body layer, and the shipping chip lens on "Current" chips (Chromium only). */
function applyLens(el: HTMLElement, kind: Kind, w: number, h: number, r: number, cur: HTMLElement) {
  const body = el.querySelector<HTMLElement>(':scope > .lq-body');
  if (!body) return;
  const tier = el.closest<HTMLElement>('[data-tier]')?.dataset.tier as Tier | undefined;
  const chromium = chromiumBackdropLens();
  if (chromium && kind === 'chip' && tier === 'current') {
    cur.classList.add('lens');
    cur.style.setProperty('--lens', `url(#${currentChipLens(w, h)})`);
  } else {
    cur.classList.remove('lens');
    cur.style.removeProperty('--lens');
  }
  if (chromium && tier === 't1' && !el.classList.contains('union-member')) {
    const id = lensFilter(w, h, r, {
      bezel: state.bezel,
      ior: IOR,
      depth: depth(),
      chroma: state.chroma,
      maxPull: MAX_PULL,
    });
    const filter = `url(#${id}) ${filterString(kind, state.blur * KIND_SIGMA[kind])}`;
    body.style.setProperty('backdrop-filter', filter);
    body.style.setProperty('-webkit-backdrop-filter', filter);
  } else {
    body.style.removeProperty('backdrop-filter');
    body.style.removeProperty('-webkit-backdrop-filter');
  }
}

/** Press light at the pointer (every tier: a plain gradient, no backdrop work). */
function pressAt(el: HTMLElement, glow: HTMLElement, event: PointerEvent) {
  const box = el.getBoundingClientRect();
  glow.style.setProperty('--gx', `${event.clientX - box.left}px`);
  glow.style.setProperty('--gy', `${event.clientY - box.top}px`);
  el.dataset.pressed = '';
}

function attachPress(el: HTMLElement, glow: HTMLElement) {
  el.addEventListener('pointerdown', (event) => {
    pressAt(el, glow, event);
  });
  const up = () => {
    delete el.dataset.pressed;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);
}

/**
 * Drag with squish: a press lifts the piece (scale 1.06, iOS 26's controls grow under the
 * finger), moving stretches it along the velocity and thins it across (liquid-glass-react's
 * "elasticity", MIT, here on a spring), and a release lets it wobble back.
 */
const LIFT = { stiffness: 420, damping: 24 };
const WOBBLE = { stiffness: 260, damping: 9 };
const ELASTICITY = 0.35;

function attachDrag(el: HTMLElement, glow: HTMLElement, onMove?: () => void) {
  const sx = new Spring(1, LIFT);
  const sy = new Spring(1, LIFT);
  let lift = 1;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  let vx = 0;
  let vy = 0;
  let lastX = 0;
  let lastY = 0;
  let lastT = 0;
  let running = false;
  const task: Task = (dt) => {
    const speed = Math.hypot(vx, vy);
    const stretch = Math.min(speed / 2000, 1) * ELASTICITY;
    const ax = speed > 0 ? Math.abs(vx) / speed : 0;
    const ay = speed > 0 ? Math.abs(vy) / speed : 0;
    sx.to(lift * (1 + ax * stretch * 0.6 - ay * stretch * 0.3));
    sy.to(lift * (1 + ay * stretch * 0.6 - ax * stretch * 0.3));
    vx *= Math.exp(-dt * 10);
    vy *= Math.exp(-dt * 10);
    sx.step(dt);
    sy.step(dt);
    el.style.transform =
      sx.settled && sy.settled && !dragging && lift === 1
        ? ''
        : `scale(${sx.value.toFixed(4)}, ${sy.value.toFixed(4)})`;
    onMove?.();
    running = dragging || !(sx.settled && sy.settled);
    return running;
  };
  const start = () => {
    if (!running) {
      running = true;
      addTask(task);
    }
  };
  el.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    el.setPointerCapture(event.pointerId);
    dragging = true;
    el.classList.add('dragging');
    pressAt(el, glow, event);
    startX = event.clientX;
    startY = event.clientY;
    originX = el.offsetLeft;
    originY = el.offsetTop;
    lastX = event.clientX;
    lastY = event.clientY;
    lastT = event.timeStamp;
    vx = 0;
    vy = 0;
    lift = 1.06;
    sx.config = LIFT;
    sy.config = LIFT;
    start();
  });
  el.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dt = Math.max(1, event.timeStamp - lastT) / 1000;
    vx = vx * 0.6 + ((event.clientX - lastX) / dt) * 0.4;
    vy = vy * 0.6 + ((event.clientY - lastY) / dt) * 0.4;
    lastX = event.clientX;
    lastY = event.clientY;
    lastT = event.timeStamp;
    el.style.left = `${originX + event.clientX - startX}px`;
    el.style.top = `${originY + event.clientY - startY}px`;
    start();
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    delete el.dataset.pressed;
    lift = 1;
    sx.config = WOBBLE;
    sy.config = WOBBLE;
    start();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/** Button and row markup helpers. */
export const button = (name: Glyph, label: string): string =>
  `<span class="btn" role="img" aria-label="${label}">${glyph(name)}</span>`;

export const row = (name: Glyph, label: string, quiet = false): string =>
  `<div class="row${quiet ? ' quiet' : ''}">${glyph(name)}<span>${label}</span></div>`;
