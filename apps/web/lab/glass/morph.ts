/**
 * The morph stage: the ⋯ button swelling into its menu as one liquid body (iOS 26 Preview's ⋯
 * menu, frames at 39.4–40.0 s of the owner's recording), and two capsules fusing.
 *
 * Choreography, from Liquid DOM's showcase MenuDemo (Andras Prifer, MIT), which matches the
 * recording: the menu starts as a 40 px round blob behind the button; its centre springs out
 * (stiffness 144, damping 14, launched), its size eases over 300 ms on cubic-bezier(0.8, 0.3,
 * 0.5, 0.8) and its radius over 700 ms; the content arrives blurred 8 px at twice its size and
 * fades in on a spring (137/20) while the blur and scale ease out over 300 ms; the button rides
 * into the menu's centre (499/22) and shrinks to half (155/24), so the smooth union swallows it.
 * Closing runs the other way on softer springs (130/18; the button returns on 90/20).
 *
 * How each tier draws the fused shape:
 * - T2: the shapes share a group, the shader's smooth minimum fuses them (`t2-gl.ts`);
 * - T0/T1: one glass element per group is masked by the union's outline
 *   (`contour.ts`), with an SVG rim along the same path; the members show content only;
 * - Current: the app's container transform (MOT-5), a clip-path reveal from the trigger.
 */
import { contourPath } from './contour';
import { button, createPiece, type Kind, type Piece, row } from './pieces';
import { addTask } from './loop';
import { sceneDistance, type Shape } from './sdf';
import { bezier, easeIn, easeOut, Spring, Tween } from './spring';
import { state } from './state';
import type { ShapeSource } from './t2-gl';

const BUTTON = 44;
const CLOSED = 40;
const MENU_W = 250;
const MENU_H = 300;
const OPEN_R = 26;
const CAP_W = 156;
const CAP_H = 56;

const MENU_OPEN = { stiffness: 144, damping: 14 };
const MENU_CLOSE = { stiffness: 130, damping: 18 };
const BUTTON_OPEN = { stiffness: 499, damping: 22 };
const BUTTON_CLOSE = { stiffness: 90, damping: 20 };
const BUTTON_SCALE = { stiffness: 155, damping: 24 };
const CONTENT = { stiffness: 137, damping: 20 };
const MERGE = { stiffness: 300, damping: 20 };
const SIZE_OPEN = bezier(0.8, 0.3, 0.5, 0.8);

const SVG_NS = 'http://www.w3.org/2000/svg';

/** One glass element drawing the outline of a group of shapes (T0/T1). */
class UnionGlass {
  readonly el: HTMLElement;
  private readonly body: HTMLElement;
  private readonly rim: SVGPathElement;
  private readonly band: SVGPathElement;
  private readonly clip: SVGPathElement;
  private readonly shadow: SVGPathElement;
  private readonly hole: SVGPathElement;

  constructor(host: HTMLElement, id: string) {
    this.el = document.createElement('div');
    this.el.className = 'union';
    this.body = document.createElement('div');
    this.body.className = 'lq-body';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      `<defs><linearGradient id="${id}-g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="#fff" stop-opacity="0.75"/><stop offset="0.3" stop-color="#fff" stop-opacity="0.1"/>` +
      `<stop offset="0.7" stop-color="#fff" stop-opacity="0.1"/><stop offset="1" stop-color="#fff" stop-opacity="0.45"/></linearGradient>` +
      `<filter id="${id}-b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>` +
      `<filter id="${id}-s" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10"/></filter>` +
      `<mask id="${id}-m" maskUnits="userSpaceOnUse" x="-100" y="-100" width="4000" height="4000">` +
      `<rect x="-100" y="-100" width="4000" height="4000" fill="#fff"/><path class="hole" fill="#000"/></mask>` +
      `<clipPath id="${id}-c"><path/></clipPath></defs>` +
      `<g mask="url(#${id}-m)"><path class="shadow" fill="#000" fill-opacity="0.32" transform="translate(0 8)" filter="url(#${id}-s)"/></g>` +
      `<path class="band" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="16" filter="url(#${id}-b)" clip-path="url(#${id}-c)"/>` +
      `<path class="rim" fill="none" stroke="url(#${id}-g)" stroke-width="1.2"/>`;
    this.el.append(this.body, svg);
    host.prepend(this.el);
    this.rim = svg.querySelector('.rim') as SVGPathElement;
    this.band = svg.querySelector('.band') as SVGPathElement;
    this.clip = svg.querySelector('clipPath path') as SVGPathElement;
    this.shadow = svg.querySelector('.shadow') as SVGPathElement;
    this.hole = svg.querySelector('.hole') as SVGPathElement;
  }

  update(shapes: readonly Shape[], k: number, kind: Kind): void {
    this.el.dataset.kind = kind;
    let left = Number.POSITIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const s of shapes) {
      left = Math.min(left, s.cx - s.hw);
      top = Math.min(top, s.cy - s.hh);
      right = Math.max(right, s.cx + s.hw);
      bottom = Math.max(bottom, s.cy + s.hh);
    }
    const pad = 4;
    left = Math.floor(left - pad);
    top = Math.floor(top - pad);
    const w = Math.ceil(right + pad - left);
    const h = Math.ceil(bottom + pad - top);
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    this.el.style.width = `${w}px`;
    this.el.style.height = `${h}px`;
    const d = contourPath((x, y) => sceneDistance(x, y, shapes, k), left, top, w, h, 2.5);
    // The outline as a mask, not `clip-path: path()`: Chromium left the filtered backdrop of a
    // path-clipped layer unclipped in places here (a dark square corner), a mask held.
    const svg = `<svg xmlns="${SVG_NS}" width="${w}" height="${h}"><path d="${d}" fill="#fff"/></svg>`;
    const mask = d ? `url("data:image/svg+xml,${encodeURIComponent(svg)}")` : 'none';
    this.body.style.setProperty('-webkit-mask-image', mask);
    this.body.style.setProperty('mask-image', mask);
    this.rim.setAttribute('d', d);
    this.band.setAttribute('d', d);
    this.clip.setAttribute('d', d);
    this.hole.setAttribute('d', d);
    this.shadow.setAttribute('d', d);
    this.shadow.setAttribute(
      'fill-opacity',
      state.shadow ? (state.theme === 'dark' ? '0.34' : '0.14') : '0',
    );
    this.band.setAttribute('stroke-opacity', (0.14 * Math.min(1, state.refraction)).toFixed(3));
    this.band.setAttribute('stroke-width', String(state.bezel));
    this.rim.setAttribute('stroke-opacity', state.spec.toFixed(2));
  }
}

export interface MorphStage {
  readonly shapes: () => readonly ShapeSource[];
  readonly pieces: readonly Piece[];
  toggleMenu(): void;
  toggleMerge(): void;
  setSlow(slow: boolean): void;
  /** Re-lays out after a resize or a tier change. */
  layout(): void;
}

export function createMorphStage(
  stage: HTMLElement,
  host: HTMLElement,
  invalidate: () => void,
): MorphStage {
  const width = () => stage.clientWidth;
  const back = createPiece({
    kind: 'round',
    label: 'Back',
    x: 16,
    y: 16,
    w: BUTTON,
    h: BUTTON,
    html: button('back', 'Back'),
    fixed: true,
  });
  const menu = createPiece({
    kind: 'menu',
    label: 'More menu',
    x: 0,
    y: 0,
    w: CLOSED,
    h: CLOSED,
    r: CLOSED / 2,
    fixed: true,
    html:
      `<div class="menu-list" style="width:${MENU_W}px;height:${MENU_H}px;flex:none">` +
      row('rotate', 'Rotate left') +
      '<div class="sep"></div>' +
      row('undo', 'Undo') +
      row('redo', 'Redo', true) +
      '<div class="sep"></div>' +
      row('moon', 'Dark page') +
      row('fit', 'Fit width') +
      row('jump', 'Go to page…') +
      '</div>',
  });
  const more = createPiece({
    kind: 'round',
    label: 'More',
    x: 0,
    y: 16,
    w: BUTTON,
    h: BUTTON,
    html: button('more', 'More'),
    fixed: true,
  });
  const onCapsuleMove = () => {
    syncUnions();
    invalidate();
  };
  const capA = createPiece(
    {
      kind: 'capsule',
      label: 'Markup tools',
      x: 0,
      y: 0,
      w: CAP_W,
      h: CAP_H,
      html: button('pen', 'Markup') + button('text', 'Text') + button('select', 'Select'),
    },
    onCapsuleMove,
  );
  const capB = createPiece(
    {
      kind: 'capsule',
      label: 'Document tools',
      x: 0,
      y: 0,
      w: CAP_W,
      h: CAP_H,
      html: button('info', 'Info') + button('share', 'Share') + button('search', 'Search'),
    },
    onCapsuleMove,
  );
  const list = menu.el.querySelector<HTMLElement>('.menu-list');
  const menuContent = menu.el.querySelector<HTMLElement>('.content');
  if (menuContent) {
    menuContent.style.overflow = 'hidden';
    menuContent.style.borderRadius = 'inherit';
    menuContent.style.justifyContent = 'center';
    menuContent.style.padding = '0';
  }
  const moreGlyph = more.el.querySelector<HTMLElement>('.content');
  for (const piece of [back, menu, more, capA, capB]) host.append(piece.el);
  for (const piece of [menu, more, capA, capB]) piece.el.classList.add('union-member');
  const menuUnion = new UnionGlass(host, 'u-menu');
  const capUnion = new UnionGlass(host, 'u-caps');

  // The menu's geometry: centre, size, radius; the button's centre and scale; the content.
  const anchor = () => ({ x: width() - 16 - BUTTON / 2, y: 16 + BUTTON / 2 });
  const openCentre = () => {
    const a = anchor();
    return { x: a.x + BUTTON / 2 + 4 - MENU_W / 2, y: a.y - BUTTON / 2 - 4 + MENU_H / 2 };
  };
  let a0 = anchor();
  const mx = new Spring(a0.x, MENU_OPEN);
  const my = new Spring(a0.y, MENU_OPEN);
  const mw = new Tween(CLOSED);
  const mh = new Tween(CLOSED);
  const mr = new Tween(CLOSED / 2);
  const bx = new Spring(a0.x, BUTTON_OPEN);
  const by = new Spring(a0.y, BUTTON_OPEN);
  const bs = new Spring(1, BUTTON_SCALE);
  const fade = new Spring(0, CONTENT);
  const blur = new Tween(8);
  const zoom = new Tween(2);
  const glyphFade = new Tween(1);
  const reveal = new Tween(0);
  let open = false;
  let slow = 1;
  // The capsules: the gap between them.
  const gap = new Spring(16, MERGE);
  let merged = false;

  const menuShapes = (): Shape[] => {
    const s = bs.value;
    const shapes: Shape[] = [
      {
        cx: bx.value,
        cy: by.value,
        hw: (BUTTON / 2) * s,
        hh: (BUTTON / 2) * s,
        r: (BUTTON / 2) * s,
        group: 1,
      },
    ];
    if (open || !mw.settled || mw.value > CLOSED + 0.5) {
      shapes.unshift({
        cx: mx.value,
        cy: my.value,
        hw: mw.value / 2,
        hh: mh.value / 2,
        r: Math.min(mr.value, mw.value / 2, mh.value / 2),
        group: 1,
      });
    }
    return shapes;
  };
  const rectOf = (el: HTMLElement, group: number): Shape => {
    const x = el.offsetLeft;
    const y = el.offsetTop;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    return { cx: x + w / 2, cy: y + h / 2, hw: w / 2, hh: h / 2, r: h / 2, group };
  };
  const syncUnions = () => {
    if (state.tier !== 't0' && state.tier !== 't1') return;
    menuUnion.update(menuShapes(), state.k, open || !mw.settled ? 'menu' : 'round');
    capUnion.update([rectOf(capA.el, 2), rectOf(capB.el, 2)], state.k, 'capsule');
  };

  const apply = () => {
    const current = state.tier === 'current';
    if (current) {
      // MOT-5: the menu at its final size, revealed from the trigger's rounded rect.
      const c = openCentre();
      const left = c.x - MENU_W / 2;
      const top = c.y - MENU_H / 2;
      Object.assign(menu.el.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${MENU_W}px`,
        height: `${MENU_H}px`,
        borderRadius: '16px',
      });
      const a = anchor();
      const t = reveal.value;
      const ins = {
        top: (a.y - BUTTON / 2 - top) * (1 - t),
        right: (left + MENU_W - (a.x + BUTTON / 2)) * (1 - t),
        bottom: (top + MENU_H - (a.y + BUTTON / 2)) * (1 - t),
        left: (a.x - BUTTON / 2 - left) * (1 - t),
      };
      menu.el.style.clipPath = `inset(${ins.top}px ${ins.right}px ${ins.bottom}px ${ins.left}px round ${22 * (1 - t) + 16 * t}px)`;
      menu.el.style.opacity = t <= 0.001 ? '0' : '1';
      menu.el.style.visibility = t <= 0.001 ? 'hidden' : 'visible';
      if (list) {
        list.style.opacity = String(t);
        list.style.filter = '';
        list.style.transform = '';
      }
      more.el.style.left = `${a.x - BUTTON / 2}px`;
      more.el.style.top = `${a.y - BUTTON / 2}px`;
      more.el.style.transform = '';
      if (moreGlyph) moreGlyph.style.opacity = '1';
    } else {
      menu.el.style.clipPath = '';
      menu.el.style.opacity = '1';
      const hidden = !open && mw.settled && mw.value <= CLOSED + 0.5;
      menu.el.style.visibility = hidden ? 'hidden' : 'visible';
      const r = Math.min(mr.value, mw.value / 2, mh.value / 2);
      Object.assign(menu.el.style, {
        left: `${mx.value - mw.value / 2}px`,
        top: `${my.value - mh.value / 2}px`,
        width: `${mw.value}px`,
        height: `${mh.value}px`,
        borderRadius: `${r}px`,
      });
      if (list) {
        list.style.opacity = String(Math.max(0, Math.min(1, fade.value)));
        list.style.filter = blur.value > 0.05 ? `blur(${blur.value.toFixed(2)}px)` : '';
        list.style.transform =
          Math.abs(zoom.value - 1) > 0.001 ? `scale(${zoom.value.toFixed(4)})` : '';
      }
      more.el.style.left = `${bx.value - BUTTON / 2}px`;
      more.el.style.top = `${by.value - BUTTON / 2}px`;
      more.el.style.transform =
        Math.abs(bs.value - 1) > 0.001 ? `scale(${bs.value.toFixed(4)})` : '';
      if (moreGlyph) moreGlyph.style.opacity = String(glyphFade.value);
    }
    const centre = width() / 2;
    const half = gap.value / 2;
    const top = stage.clientHeight - 24 - CAP_H;
    if (!capA.el.classList.contains('dragging')) {
      capA.el.style.left = `${centre - half - CAP_W}px`;
      capA.el.style.top = `${top}px`;
    }
    if (!capB.el.classList.contains('dragging')) {
      capB.el.style.left = `${centre + half}px`;
      capB.el.style.top = `${top}px`;
    }
    syncUnions();
    invalidate();
  };

  let running = false;
  const springs = [mx, my, bx, by, bs, fade, gap];
  const tweens = [mw, mh, mr, blur, zoom, glyphFade, reveal];
  const run = () => {
    if (running) return;
    running = true;
    addTask((dt) => {
      const step = dt * slow;
      for (const s of springs) s.step(step);
      for (const t of tweens) t.step(step);
      apply();
      running = !(springs.every((s) => s.settled) && tweens.every((t) => t.settled));
      return running;
    });
  };

  const toggleMenu = () => {
    open = !open;
    const a = anchor();
    const c = openCentre();
    if (open) {
      // Launched towards the open centre: the overshoot reads as the blob's momentum.
      mx.to(c.x, MENU_OPEN, (c.x - a.x) * 4);
      my.to(c.y, MENU_OPEN, (c.y - a.y) * 4);
      mw.to(MENU_W, 0.3, SIZE_OPEN);
      mh.to(MENU_H, 0.3, SIZE_OPEN);
      mr.to(OPEN_R, 0.7, easeOut);
      bx.to(c.x, BUTTON_OPEN);
      by.to(c.y, BUTTON_OPEN);
      bs.to(0.5, BUTTON_SCALE);
      fade.to(1, CONTENT);
      blur.snap(8);
      zoom.snap(2);
      blur.to(0, 0.3, easeOut);
      zoom.to(1, 0.3, easeOut);
      glyphFade.to(0, 0.01, easeOut);
      reveal.to(1, 0.24, easeOut);
    } else {
      mx.to(a.x, MENU_CLOSE);
      my.to(a.y, MENU_CLOSE);
      mw.to(CLOSED, 0.25, easeOut);
      mh.to(CLOSED, 0.25, easeOut);
      mr.to(CLOSED / 2, 0.7, easeOut);
      bx.to(a.x, BUTTON_CLOSE, (a.x - c.x) * 2);
      by.to(a.y, BUTTON_CLOSE, (a.y - c.y) * 2);
      bs.to(1, BUTTON_SCALE);
      fade.to(0, CONTENT);
      blur.to(8, 0.3, easeOut);
      zoom.to(2, 0.3, easeOut);
      glyphFade.to(1, 0.15, easeIn);
      reveal.to(0, 0.2, easeIn);
    }
    run();
  };
  more.el.addEventListener('click', toggleMenu);
  menu.el.addEventListener('click', () => {
    if (open) toggleMenu();
  });

  const toggleMerge = () => {
    merged = !merged;
    gap.to(merged ? -2 : 16, MERGE);
    run();
  };

  const layout = () => {
    a0 = anchor();
    if (!open) {
      for (const s of [mx, bx]) s.snap(a0.x);
      for (const s of [my, by]) s.snap(a0.y);
    } else {
      const c = openCentre();
      for (const s of [mx, bx]) s.snap(c.x);
      for (const s of [my, by]) s.snap(c.y);
    }
    apply();
    for (const piece of [back, menu, more, capA, capB]) piece.refresh();
  };

  return {
    pieces: [back, menu, more, capA, capB],
    shapes: () => [
      { el: back.el, group: 0, frost: 0.85 },
      ...(menu.el.style.visibility === 'hidden'
        ? []
        : [{ el: menu.el, group: 1, frost: 1, tint: 1.25 }]),
      { el: more.el, group: 1, frost: 0.85 },
      { el: capA.el, group: 2, frost: 0.85 },
      { el: capB.el, group: 2, frost: 0.85 },
    ],
    toggleMenu,
    toggleMerge,
    setSlow(value) {
      slow = value ? 0.15 : 1;
    },
    layout,
  };
}
