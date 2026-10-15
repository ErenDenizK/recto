/**
 * Recto's glass lab (docs/research/23-liquid-glass-lab.md; decisions GLS-1 to GLS-6): a page
 * beside the app, never loaded by it, that compares the shipping materials with three liquid
 * glass tiers over our own sample pages, with live sliders, a frame meter, draggable pieces, the
 * morph demos and a phone frame.
 *
 * It shares no JavaScript module with the app (a shared module would split a chunk out of the
 * app's first-paint path, 119.8 of 120 KB): the app's tokens and materials come in as CSS text
 * (`?inline`, a module id of their own), so "Current" is the real `materials.css`.
 */
import fontsCss from '../../src/styles/fonts.css?inline';
import materialsCss from '../../src/styles/materials.css?inline';
import tokensCss from '../../src/styles/tokens.css?inline';
import {
  type BackdropKind,
  buildColumn,
  CANVAS,
  loadPages,
  type LumaMap,
  lumaMap,
  medianLuma,
  type Theme,
} from './backdrop';
import labCss from './lab.css?inline';
import { addTask, meter } from './loop';
import { createMorphStage, type MorphStage } from './morph';
import { REFERENCES_HTML, TIERS_HTML } from './notes';
import {
  allPieces,
  button,
  createPiece,
  filterOf,
  type Look,
  type Piece,
  type PieceSpec,
  row,
  tintOf,
  writeT0,
} from './pieces';
import { depth, MAX_PULL, state, type Tier } from './state';
import { chromiumBackdropLens, clearLenses } from './t1-lens';
import {
  type GlassParams,
  GlassRenderer,
  rendererName,
  type ShapeSource,
  tierRecipe,
  webgl2Available,
} from './t2-gl';

for (const css of [fontsCss, tokensCss, materialsCss, labCss]) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}

const root = document.documentElement;

interface StageCtx {
  readonly name: 'main' | 'morph' | 'phone';
  readonly el: HTMLElement;
  readonly scroller: HTMLElement;
  readonly host: HTMLElement;
  readonly edge: HTMLElement | null;
  readonly edgeHeight: number;
  readonly pageShare: () => number;
  readonly gap: number;
  shapes: () => readonly ShapeSource[];
  column: HTMLCanvasElement | null;
  renderer: GlassRenderer | null;
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
  html = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (html) node.innerHTML = html;
  return node;
}

function makeStage(
  name: StageCtx['name'],
  cls: string,
  edgeHeight: number,
  pageShare: () => number,
  gap: number,
): StageCtx {
  const el = h('div', { class: `stage ${cls}`, 'data-tier': state.tier, 'data-stage': name });
  const scroller = h('div', { class: 'scroller', tabindex: '0', 'aria-label': 'Backdrop' });
  const host = h('div', { class: 'pieces' });
  let edge: HTMLElement | null = null;
  if (edgeHeight > 0) {
    edge = h('div', { class: 'edge', 'aria-hidden': 'true' }, '<span></span>');
    edge.style.height = `${edgeHeight}px`;
  }
  el.append(scroller);
  if (edge) el.append(edge);
  el.append(host);
  return {
    name,
    el,
    scroller,
    host,
    edge,
    edgeHeight,
    pageShare,
    gap,
    shapes: () => [],
    column: null,
    renderer: null,
  };
}

// ── Layout ───────────────────────────────────────────────────────────────────────────────
const lab = h('div', { class: 'lab' });
const head = h(
  'header',
  { class: 'lab-head' },
  '<h1>Recto glass lab</h1><p>Current materials beside three liquid-glass tiers, over the sample pages. Drag the pieces; nothing here is the app.</p>',
);
const panel = h('aside', { class: 'panel', 'aria-label': 'Lab settings' });
const main = h('main', { class: 'main' });
lab.append(head, panel, main);
document.body.append(lab);

const narrow = () => globalThis.innerWidth < 860;
const mainStage = makeStage('main', 'main-stage', 96, () => (narrow() ? 0.94 : 0.7), 28);
const morphStage = makeStage('morph', 'morph', 80, () => (narrow() ? 0.94 : 0.82), 24);
const phoneStage = makeStage('phone', 'phone-stage', 110, () => 1, 8);
const stages = [mainStage, morphStage, phoneStage];

function section(id: string, title: string, text: string): HTMLElement {
  const node = h('section', { class: 'section', id, 'aria-labelledby': `${id}-h` });
  node.append(h('h2', { id: `${id}-h` }, title), h('p', {}, text));
  main.append(node);
  return node;
}

section(
  'stage',
  'Stage',
  'The pieces at their app sizes: the phone top bar (48), the page pill (M1 chip, 40), a menu (M4), the reader capsule (56) and the edit button, and a 140 px lens to see the optics. Scroll the backdrop or turn on auto-scroll; drag a piece to see refraction move and the squish.',
).append(mainStage.el);

const morphSection = section(
  'morph',
  'Morph and merge',
  'Tap ⋯: the button swells into its menu as one body (T2 fuses by a smooth minimum; T0 and T1 mask one glass element with the union’s outline). The capsules fuse when merged or dragged together. Current shows the app’s container transform (MOT-5).',
);
const morphBar = h('div', { class: 'morph-bar' });
const morphButtons = {
  menu: h('button', { type: 'button' }, 'Open or close the menu'),
  merge: h('button', { type: 'button' }, 'Merge or split the capsules'),
  slow: h('button', { type: 'button', 'aria-pressed': 'false' }, 'Slow motion'),
};
morphBar.append(morphButtons.menu, morphButtons.merge, morphButtons.slow);
morphSection.append(morphBar, morphStage.el);

const phoneSection = section(
  'phone',
  'Phone',
  'The compact reader at 390 × 844: the floating 48 px top bar (DSN-32), the 56 px capsule and edit button above the home indicator, and the scroll edge under the status bar.',
);
const phoneWrap = h('div', { class: 'phone-wrap' });
const phone = h('div', { class: 'phone' });
phone.append(phoneStage.el);
phoneStage.el.append(
  h('div', { class: 'status', 'aria-hidden': 'true' }, '<span>9:41</span><span>100%</span>'),
  h('div', { class: 'home', 'aria-hidden': 'true' }),
);
const phoneNotes = h(
  'div',
  { class: 'phone-notes' },
  '<p>iOS 26 Preview keeps the page sharp to the top and lets it fade into the status bar under a progressive blur and a dark tint; its controls are small, nearly clear glass with a bright rim. Compare the tiers here with the frames in the report.</p>',
);
const phoneBox = h('div', { class: 'phone-box' });
phoneBox.append(phone);
phoneWrap.append(phoneBox, phoneNotes);
/** Scales the 410 px frame down on a narrow screen (a transform: no backdrop root, Q-3). */
function fitPhone(): void {
  const room = main.clientWidth;
  const scale = Math.min(1, room / 410);
  phone.style.transform = scale < 1 ? `scale(${scale.toFixed(4)})` : '';
  phoneBox.style.width = `${Math.round(410 * scale)}px`;
  phoneBox.style.height = `${Math.round(864 * scale)}px`;
}
globalThis.addEventListener('resize', fitPhone);
phoneSection.append(phoneWrap);

section('tiers', 'Tiers', 'What each tier draws and who gets it.').insertAdjacentHTML(
  'beforeend',
  TIERS_HTML,
);
section(
  'refs',
  'References',
  'Read from source only (no third-party code runs here). All four libraries are MIT; techniques adapted here are credited in the code.',
).insertAdjacentHTML('beforeend', REFERENCES_HTML);

// ── Pieces ───────────────────────────────────────────────────────────────────────────────
let lookFrame = 0;
function looksSoon(): void {
  if (lookFrame !== 0 || !state.adaptive) return;
  lookFrame = requestAnimationFrame(() => {
    lookFrame = 0;
    updateLooks();
  });
}

function addPieces(ctx: StageCtx, specs: PieceSpec[], sources: (pieces: Piece[]) => ShapeSource[]) {
  const made = specs.map((spec) =>
    createPiece(spec, () => {
      ctx.renderer?.invalidate();
      looksSoon();
    }),
  );
  ctx.scroller.addEventListener('scroll', looksSoon, { passive: true });
  for (const piece of made) ctx.host.append(piece.el);
  ctx.shapes = () => sources(made);
  return made;
}

const topBarHtml =
  button('back', 'Back') +
  '<span class="title">Margin No. 07 · sample</span>' +
  button('more', 'More');

function mainSpecs(width: number, height: number): PieceSpec[] {
  const dockW = 240 + 8 + 56;
  const dockX = Math.max(8, (width - dockW) / 2);
  const menuW = Math.min(250, width - 24);
  return [
    {
      kind: 'bar',
      label: 'Top bar',
      x: Math.max(12, 24),
      y: 18,
      w: Math.min(560, width - 48),
      h: 48,
      html: topBarHtml,
    },
    {
      kind: 'chip',
      label: 'Page pill',
      x: 24,
      y: 82,
      w: 112,
      h: 40,
      html: '<span class="pill-text"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v4h4"/></svg>2 / 4</span>',
    },
    {
      kind: 'menu',
      label: 'Menu',
      x: width - 24 - menuW,
      y: 82,
      w: menuW,
      h: 292,
      r: 22,
      html:
        '<div class="menu-list">' +
        row('rotate', 'Rotate left') +
        '<div class="sep"></div>' +
        row('undo', 'Undo') +
        row('redo', 'Redo', true) +
        '<div class="sep"></div>' +
        row('moon', 'Dark page') +
        row('fit', 'Fit width') +
        row('jump', 'Go to page…') +
        '</div>',
    },
    {
      kind: 'round',
      label: 'Lens',
      x: Math.round(width * 0.36 - 70),
      y: Math.round(height * 0.42 - 70),
      w: 140,
      h: 140,
      html: '',
    },
    {
      kind: 'capsule',
      label: 'Reader capsule',
      x: dockX,
      y: height - 24 - 56,
      w: 240,
      h: 56,
      html:
        button('pages', 'Pages') +
        button('search', 'Search') +
        button('marker', 'Highlight') +
        button('text', 'Text') +
        button('share', 'Share'),
    },
    {
      kind: 'round',
      label: 'Edit',
      x: dockX + 248,
      y: height - 24 - 56,
      w: 56,
      h: 56,
      html: button('pen', 'Edit'),
    },
  ];
}

function setupPieces(): MorphStage {
  const w = mainStage.el.clientWidth;
  const hgt = mainStage.el.clientHeight;
  addPieces(mainStage, mainSpecs(w, hgt), (made) =>
    made.map((piece, i) => ({
      el: piece.el,
      group: 10 + i,
      frost: piece.spec.kind === 'menu' ? 1 : 0.75,
      tint: piece.spec.kind === 'menu' ? 1.25 : 1,
    })),
  );
  const morph = createMorphStage(morphStage.el, morphStage.host, () => {
    morphStage.renderer?.invalidate();
  });
  morphStage.shapes = morph.shapes;
  const PW = 390;
  const PH = 844;
  const dockW = 194 + 8 + 56;
  const dockX = (PW - dockW) / 2;
  addPieces(
    phoneStage,
    [
      {
        kind: 'bar',
        label: 'Top bar',
        x: 12,
        y: 47,
        w: PW - 24,
        h: 48,
        html: topBarHtml,
        fixed: true,
      },
      {
        kind: 'capsule',
        label: 'Reader capsule',
        x: dockX,
        y: PH - 34 - 56,
        w: 194,
        h: 56,
        html:
          button('pages', 'Pages') +
          button('search', 'Search') +
          button('marker', 'Highlight') +
          button('more', 'More'),
        fixed: true,
      },
      {
        kind: 'round',
        label: 'Edit',
        x: dockX + 194 + 8,
        y: PH - 34 - 56,
        w: 56,
        h: 56,
        html: button('pen', 'Edit'),
        fixed: true,
      },
    ],
    (made) => made.map((piece, i) => ({ el: piece.el, group: 20 + i, frost: 0.75 })),
  );
  return morph;
}

// ── Backdrops and renderers ──────────────────────────────────────────────────────────────
let images: HTMLImageElement[] = [];

function buildColumns(): void {
  for (const ctx of stages) {
    const column = buildColumn({
      kind: state.backdrop,
      theme: state.theme,
      width: ctx.el.clientWidth,
      height: ctx.el.clientHeight,
      pageShare: ctx.pageShare(),
      gap: ctx.gap,
      images,
    });
    ctx.scroller.replaceChildren(column);
    ctx.column = column;
    lumas.set(ctx, lumaMap(column));
    ctx.renderer?.setColumn(column);
  }
  updateLooks();
}

// ── The adaptive look (iOS 26's small controls: light glass over paper, dark over a photo) ──
const lumas = new Map<StageCtx, LumaMap>();
const mixes = new Map<HTMLElement, number>();
let easing = false;

/**
 * Each piece reads the median luminance of the page raster under it (Liquid DOM's adaptive
 * tint recipe: the median, with hysteresis, eased) and takes the light or dark look. Only the
 * main and phone stages: the morph's fused glass keeps one look.
 */
function updateLooks(): void {
  for (const ctx of [mainStage, phoneStage]) {
    const map = lumas.get(ctx);
    for (const el of ctx.host.querySelectorAll<HTMLElement>('.piece')) {
      if (!state.adaptive || !map || state.tier === 'current') {
        delete el.dataset.look;
        mixes.set(el, 0);
        el.dataset.lookMix = '0';
        continue;
      }
      const luma = medianLuma(
        map,
        el.offsetLeft + ctx.scroller.scrollLeft,
        el.offsetTop + ctx.scroller.scrollTop,
        el.offsetWidth,
        el.offsetHeight,
      );
      const previous = (el.dataset.look as Look | undefined) ?? state.theme;
      const look: Look = luma > 0.45 ? 'light' : luma < 0.2 ? 'dark' : previous;
      el.dataset.look = look;
    }
  }
  if (!easing) {
    easing = true;
    addTask((dt) => {
      let moving = false;
      for (const ctx of [mainStage, phoneStage]) {
        for (const el of ctx.host.querySelectorAll<HTMLElement>('.piece')) {
          const target = el.dataset.look && el.dataset.look !== state.theme ? 1 : 0;
          const current = mixes.get(el) ?? 0;
          const next =
            Math.abs(target - current) < 0.02
              ? target
              : current +
                Math.sign(target - current) * Math.min(Math.abs(target - current), dt / 0.26);
          if (next !== current) moving = true;
          mixes.set(el, next);
          el.dataset.lookMix = next.toFixed(3);
        }
        ctx.renderer?.invalidate();
      }
      easing = moving;
      return moving;
    });
  }
}

function glParams(ctx: StageCtx): GlassParams {
  const [r, g, b, a] = tintOf('bar');
  const canvas = CANVAS[state.theme];
  const cr = Number.parseInt(canvas.slice(1, 3), 16) / 255;
  const cg = Number.parseInt(canvas.slice(3, 5), 16) / 255;
  const cb = Number.parseInt(canvas.slice(5, 7), 16) / 255;
  return {
    bezel: state.bezel,
    ior: 1.5,
    depth: depth(),
    chroma: state.chroma,
    maxPull: MAX_PULL,
    blur: state.blur * 1.7,
    frost: 1,
    ...tierRecipe(state.theme),
    tint: [r / 255, g / 255, b / 255, a],
    spec: state.spec,
    specWidth: 1.25,
    light: (state.light * Math.PI) / 180,
    shadow: state.shadow ? (state.theme === 'dark' ? 0.32 : 0.16) : 0,
    edge: state.edge ? ctx.edgeHeight : 0,
    edgeTint: [cr, cg, cb, state.theme === 'dark' ? 0.7 : 0.55],
    k: state.k,
    alt: altRecipe(),
  };
}

/** The other theme's M2 recipe, for the adaptive look in T2. */
function altRecipe(): GlassParams['alt'] {
  const other: Look = state.theme === 'dark' ? 'light' : 'dark';
  const [r, g, b, a] = tintOf('bar', other);
  const { sat, contrast, bright } = filterOf('bar', other);
  return { sat, contrast, bright, tint: [r / 255, g / 255, b / 255, a] };
}

function ensureRenderer(ctx: StageCtx): GlassRenderer | null {
  if (ctx.renderer) return ctx.renderer;
  if (!webgl2Available()) return null;
  try {
    const renderer = new GlassRenderer(ctx.el, ctx.scroller, glParams(ctx));
    renderer.setShapes(() => ctx.shapes());
    if (ctx.column) renderer.setColumn(ctx.column);
    ctx.renderer = renderer;
    return renderer;
  } catch (error) {
    console.warn('T2 unavailable', error);
    return null;
  }
}

function applyTier(): void {
  root.dataset.theme = state.theme;
  for (const ctx of stages) {
    ctx.el.dataset.tier = state.tier;
    const t2 = state.tier === 't2' ? ensureRenderer(ctx) : null;
    if (ctx.renderer) {
      ctx.renderer.canvas.style.display = t2 ? '' : 'none';
      ctx.renderer.enabled = Boolean(t2);
      if (t2) {
        t2.setParams(glParams(ctx));
      }
    }
    if (ctx.edge)
      ctx.edge.style.display =
        state.edge && (state.tier === 't0' || state.tier === 't1') ? '' : 'none';
  }
  writeT0();
  refreshPieces();
  morph?.layout();
  updateLooks();
  requestAnimationFrame(() => {
    layerCount = countBackdropLayers();
  });
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined;
function refreshPieces(later = false): void {
  clearTimeout(refreshTimer);
  const run = () => {
    clearLenses();
    for (const piece of allPieces()) piece.refresh();
  };
  if (later) refreshTimer = setTimeout(run, 140);
  else run();
}

// ── Auto-scroll ──────────────────────────────────────────────────────────────────────────
const direction = new Map<StageCtx, number>();
function autoScrollTask(dt: number): boolean {
  if (!state.autoScroll) return false;
  for (const ctx of [mainStage, phoneStage]) {
    const max = ctx.scroller.scrollHeight - ctx.scroller.clientHeight;
    let dir = direction.get(ctx) ?? 1;
    let next = ctx.scroller.scrollTop + dir * 240 * dt;
    if (next >= max) {
      next = max;
      dir = -1;
    } else if (next <= 0) {
      next = 0;
      dir = 1;
    }
    direction.set(ctx, dir);
    ctx.scroller.scrollTop = next;
    ctx.renderer?.invalidate();
  }
  return true;
}

// ── Panel ────────────────────────────────────────────────────────────────────────────────
function segmented<T extends string>(
  label: string,
  options: [T, string][],
  get: () => T,
  set: (value: T) => void,
): HTMLElement {
  const group = h('div', { class: 'group', role: 'group', 'aria-label': label });
  group.append(h('span', { class: 'label' }, label));
  const seg = h('div', { class: 'seg' });
  const buttons = options.map(([value, text]) => {
    const node = h('button', { type: 'button', 'data-value': value }, text);
    node.addEventListener('click', () => {
      set(value);
      sync();
    });
    seg.append(node);
    return node;
  });
  const sync = () => {
    for (const node of buttons) {
      node.setAttribute('aria-pressed', String(node.dataset.value === get()));
    }
  };
  sync();
  syncers.push(sync);
  group.append(seg);
  return group;
}

const syncers: (() => void)[] = [];

type NumericKey = 'blur' | 'bezel' | 'refraction' | 'spec' | 'tint' | 'chroma' | 'k' | 'light';

function slider(
  label: string,
  key: NumericKey,
  min: number,
  max: number,
  step: number,
  onChange: () => void,
): HTMLElement {
  const id = `s-${key}`;
  const node = h('div', { class: 'slider' });
  const name = h('label', { for: id }, label);
  const input = h('input', {
    id,
    type: 'range',
    min: String(min),
    max: String(max),
    step: String(step),
  });
  const out = h('output', { for: id });
  const sync = () => {
    input.value = String(state[key]);
    out.textContent = String(state[key]);
  };
  input.addEventListener('input', () => {
    state[key] = Number(input.value);
    out.textContent = input.value;
    onChange();
  });
  sync();
  syncers.push(sync);
  node.append(name, input, out);
  return node;
}

function check(
  label: string,
  key: 'autoScroll' | 'edge' | 'shadow' | 'adaptive',
  onChange: () => void,
) {
  const id = `c-${key}`;
  const node = h('div', { class: 'check' });
  const input = h('input', { id, type: 'checkbox' });
  input.checked = state[key];
  input.addEventListener('change', () => {
    state[key] = input.checked;
    onChange();
  });
  syncers.push(() => {
    input.checked = state[key];
  });
  node.append(input, h('label', { for: id }, label));
  return node;
}

function paramsChanged(slow = false): void {
  writeT0();
  for (const ctx of stages) ctx.renderer?.setParams(glParams(ctx));
  if (morph) morph.layout();
  refreshPieces(slow);
}

const tierNote = h('p', { class: 'note' });
function updateTierNote(): void {
  const notes: Record<Tier, string> = {
    current: 'materials.css as it ships. The page pill carries the 6 px chip lens in Chromium.',
    t0: 'CSS only: what Safari, iOS and Firefox would get.',
    t1: chromiumBackdropLens()
      ? 'T0 plus the SVG Snell lens on every piece (Chromium).'
      : 'This engine drops backdrop url() filters: T1 shows as T0 here.',
    t2: webgl2Available() ? `WebGL2 on ${rendererName()}.` : 'No WebGL2 here: T2 cannot draw.',
  };
  tierNote.textContent = notes[state.tier];
}

panel.append(
  segmented<Tier>(
    'Tier',
    [
      ['current', 'Current'],
      ['t0', 'T0 CSS'],
      ['t1', 'T1 SVG'],
      ['t2', 'T2 GPU'],
    ],
    () => state.tier,
    (value) => {
      state.tier = value;
      applyTier();
      updateTierNote();
    },
  ),
  tierNote,
  segmented<Theme>(
    'Theme',
    [
      ['dark', 'Dark'],
      ['light', 'Light'],
    ],
    () => state.theme,
    (value) => {
      state.theme = value;
      buildColumns();
      applyTier();
    },
  ),
  segmented<BackdropKind>(
    'Backdrop',
    [
      ['paper', 'Paper'],
      ['cover', 'Cover photo'],
      ['photos', 'Photos'],
      ['gradient', 'Gradient'],
    ],
    () => state.backdrop,
    (value) => {
      state.backdrop = value;
      buildColumns();
    },
  ),
);
const sliders = h('div', { class: 'group' });
sliders.append(
  h('span', { class: 'label' }, 'Glass (T0, T1, T2)'),
  slider('Blur σ', 'blur', 0, 24, 0.5, () => {
    paramsChanged();
  }),
  slider('Bezel', 'bezel', 0, 40, 1, () => {
    paramsChanged(true);
  }),
  slider('Refraction', 'refraction', 0, 1.5, 0.05, () => {
    paramsChanged(true);
  }),
  slider('Specular', 'spec', 0, 1, 0.05, () => {
    paramsChanged();
  }),
  slider('Tint', 'tint', 0, 1.4, 0.05, () => {
    paramsChanged();
  }),
  slider('Chromatic', 'chroma', 0, 1, 0.05, () => {
    paramsChanged(true);
  }),
  slider('Merge', 'k', 0, 60, 1, () => {
    paramsChanged();
  }),
  slider('Light', 'light', -180, 180, 5, () => {
    paramsChanged();
  }),
);
panel.append(
  sliders,
  check('Auto-scroll the backdrop', 'autoScroll', () => {
    if (state.autoScroll) addTask(autoScrollTask);
  }),
  check('Scroll edge', 'edge', () => {
    applyTier();
  }),
  check('Shadows', 'shadow', () => {
    paramsChanged();
  }),
  check('Adaptive look (iOS: light over paper)', 'adaptive', () => {
    updateLooks();
  }),
);
const readout = h('dl', { class: 'meter', 'aria-live': 'off' });
panel.append(
  h('span', { class: 'label' }, 'Frames (only while something moves)'),
  readout,
  h(
    'p',
    { class: 'note' },
    'T2 draw is the CPU time of one draw call; with the measuring script it includes gl.finish(). Numbers in headless runs are software-rendered.',
  ),
);

function updateReadout(): void {
  const s = meter.stats();
  const t2 = mainStage.renderer;
  const rows: [string, string][] = [
    ['fps', s.frames > 0 ? s.fps.toFixed(1) : 'idle'],
    ['frame p50', s.frames > 0 ? `${s.p50.toFixed(1)} ms` : '–'],
    ['frame p95', s.frames > 0 ? `${s.p95.toFixed(1)} ms` : '–'],
    ['T2 draw', state.tier === 't2' && t2 ? `${t2.lastMs.toFixed(2)} ms` : '–'],
    ['blurred layers', String(layerCount)],
  ];
  readout.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

let layerCount = 0;

/** Elements with a backdrop filter in the stages right now (Q-11 counts surfaces). */
function countBackdropLayers(): number {
  let count = 0;
  for (const node of document.querySelectorAll<HTMLElement>('.stage *')) {
    if (node.offsetParent === null && getComputedStyle(node).position !== 'fixed') continue;
    const style = getComputedStyle(node);
    const filter = style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter');
    if (filter && filter !== 'none') count++;
  }
  return count;
}

morphButtons.menu.addEventListener('click', () => {
  morph?.toggleMenu();
});
morphButtons.merge.addEventListener('click', () => {
  morph?.toggleMerge();
});
morphButtons.slow.addEventListener('click', () => {
  const on = morphButtons.slow.getAttribute('aria-pressed') !== 'true';
  morphButtons.slow.setAttribute('aria-pressed', String(on));
  morph?.setSlow(on);
});

// ── Start ────────────────────────────────────────────────────────────────────────────────
let morph: MorphStage | undefined;

async function start(): Promise<void> {
  fitPhone();
  images = await loadPages();
  buildColumns();
  morph = setupPieces();
  applyTier();
  updateTierNote();
  updateReadout();
  setInterval(updateReadout, 500);
}

const ready = start();

/**
 * The measuring script's handle (Playwright; docs/research/23-liquid-glass-lab.md §6.1): set
 * the lab's state, then measure frame times while the backdrop scrolls under the glass.
 */
interface LabHandle {
  ready: Promise<void>;
  set(next: Partial<typeof state>): void;
  measure(ms: number): Promise<Record<string, number | string>>;
  toggleMenu(): void;
  toggleMerge(): void;
  setSlow(slow: boolean): void;
  /** The stages' T2 renderers, for the measuring script (null until T2 is first shown). */
  renderers(): Record<string, GlassRenderer | null>;
}

const handle: LabHandle = {
  ready,
  set(next) {
    const rebuild = next.theme !== undefined || next.backdrop !== undefined;
    Object.assign(state, next);
    if (rebuild) buildColumns();
    applyTier();
    paramsChanged();
    updateTierNote();
    for (const sync of syncers) sync();
    if (state.autoScroll) addTask(autoScrollTask);
  },
  async measure(ms) {
    const renderer = mainStage.renderer;
    if (renderer) {
      renderer.finish = true;
      renderer.drawn = 0;
    }
    let drawMs = 0;
    let draws = 0;
    let sampling = true;
    const sample = () => {
      if (renderer && state.tier === 't2') {
        drawMs += renderer.lastMs;
        draws++;
      }
      return sampling;
    };
    state.autoScroll = true;
    addTask(autoScrollTask);
    await new Promise((resolve) => setTimeout(resolve, 600));
    meter.reset();
    addTask(sample);
    await new Promise((resolve) => setTimeout(resolve, ms));
    const s = meter.stats();
    sampling = false;
    state.autoScroll = false;
    if (renderer) renderer.finish = false;
    return {
      tier: state.tier,
      fps: Number(s.fps.toFixed(1)),
      p50: Number(s.p50.toFixed(2)),
      p95: Number(s.p95.toFixed(2)),
      frames: s.frames,
      t2DrawMs: draws > 0 ? Number((drawMs / draws).toFixed(2)) : 0,
      layers: countBackdropLayers(),
    };
  },
  toggleMenu() {
    morph?.toggleMenu();
  },
  toggleMerge() {
    morph?.toggleMerge();
  },
  setSlow(slow) {
    morph?.setSlow(slow);
  },
  renderers() {
    return Object.fromEntries(stages.map((ctx) => [ctx.name, ctx.renderer]));
  },
};
(globalThis as unknown as { __glassLab: LabHandle }).__glassLab = handle;
