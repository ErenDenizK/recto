/**
 * Render quality (language.md §2.8; ADR-0024 §2.4, §2.5; ADR-0028 §2.1; spec D3-3, X36): the
 * Glass setting's start state, the automatic cost ladder, and the test-only render override.
 *
 * - **Start state.** Until the person picks a Glass setting, Recto starts at Clear, or at Tinted
 *   when WebGL's unmasked renderer names a software rasteriser (SwiftShader, llvmpipe,
 *   "Software", Microsoft Basic Render Driver; G-32): there the blur leaks at the edges and
 *   Tinted keeps text legible over whatever leaks. The probe runs once, on first need.
 * - **Cost ladder,** separate from the setting (GLS-7, GLS-10): while the person scrolls, zooms
 *   or pans, a frame monitor watches 2 s windows of drawn frames; when more than 25 % are slow,
 *   Recto takes the next step and holds it for the session: (1) GPU glass and lenses off,
 *   (2) Ambient light Still, (3) blur radii and the ring reduced, (4) the CSS+ floor (one layer,
 *   the smallest blur, no ring). Never solid: only the Solid setting is flat. A frame is slow
 *   when it takes over 20 ms and over one and a half refresh intervals, the interval being the
 *   shortest frame the monitor has seen (6 to 33 ms): 25 ms at 60 Hz, 20 ms at 120 Hz, 50 ms on
 *   a screen held at 30 Hz, so a 120 Hz phone drawing at 60 fps and a phone in Low Power Mode
 *   drawing a steady 30 are not slow; uneven frames are. A device starts at
 *   step 2 when it reports `deviceMemory ≤ 4`, or, where the memory is unknown (Safari,
 *   Firefox), four cores or fewer on a GPU that is not Apple's: Safari reports four cores on
 *   every iPhone, which held 60 fps in every recipe on the owner's bench (G-23, AU-15, GLS-10).
 *   The step reaches CSS as `data-degrade` on the root (absent at 0; `materials.css` reads 3
 *   and 4), the lens (`styles/material-lens.ts`), the GPU glass (`useGlassTier`) and the light
 *   read it here. The monitor draws frames only while input arrives, so nothing runs at rest
 *   (A-23).
 * - **Glass tier** (GLS-10, for the GPU glass renderer): `useGlassTier()` is `'gpu'` where
 *   `gpuGlassEligible()` (WebGL2, not a software rasteriser, ladder step 0, Glass Clear, no
 *   transparency, contrast or forced-colours preference), `'solid'` under Glass Solid or those
 *   preferences, `'css'` otherwise.
 * - **The render override** (X36): every CI browser renders in software and on four cores, so
 *   it would start at Tinted and step 2. Test builds (the dev server, Vitest, and a build with
 *   `RECTO_RENDER_OVERRIDE=1`, as Playwright's web server and CI's e2e build make it) read
 *   `window.__rectoRender = { degrade: 'off', glass: 'clear', light: 'auto' }`, which a
 *   Playwright init script sets (`e2e/support/render-override.ts`): `glass` replaces the start
 *   state, `degrade: 'off'` keeps the ladder at 0. Under automation (`navigator.webdriver`)
 *   with nothing set the same values apply, so no spec has to opt in; the one spec that checks
 *   the start states sets `window.__rectoRender = null` to opt out. The deploy build compiles
 *   none of it: `__RENDER_OVERRIDE__` is false there and the branch is removed.
 */
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';

/** What a person can pick (language.md §2.8). */
export type GlassSetting = 'clear' | 'tinted' | 'solid';

/** The cost ladder's steps: 0 none, GPU glass and lenses off, light Still, less blur, the floor. */
export type DegradeStep = 0 | 1 | 2 | 3 | 4;

export interface RenderOverride {
  /** `'off'` holds the ladder at 0 (no start step, no monitor); `'auto'` runs it. */
  readonly degrade: 'off' | 'auto';
  /** The start state to use instead of the probe; `'auto'` probes. */
  readonly glass: GlassSetting | 'auto';
  /** Ambient light's start (ADR-0025, D3-8): `'auto'` lets it follow its own gates. */
  readonly light: 'auto' | 'still' | 'off';
}

/** What test builds apply under automation when a spec sets nothing (X36). */
export const TEST_RENDER: RenderOverride = { degrade: 'off', glass: 'clear', light: 'auto' };

/** Whether this build reads the override: never the deploy build. */
const OVERRIDE_BUILT: boolean =
  import.meta.env.DEV || import.meta.env.MODE === 'test' || __RENDER_OVERRIDE__;

/** The override in force, if this build reads one and the page sets (or implies) it. */
export function renderOverride(): RenderOverride | undefined {
  if (!OVERRIDE_BUILT || typeof window === 'undefined') return undefined;
  const set = (window as { __rectoRender?: Partial<RenderOverride> | null }).__rectoRender;
  if (set === null) return undefined;
  if (set === undefined) {
    return typeof navigator !== 'undefined' && navigator.webdriver ? TEST_RENDER : undefined;
  }
  return {
    degrade: set.degrade === 'auto' ? 'auto' : 'off',
    glass:
      set.glass === 'tinted' || set.glass === 'solid' || set.glass === 'auto' ? set.glass : 'clear',
    light: set.light === 'still' || set.light === 'off' ? set.light : 'auto',
  };
}

/** A renderer string that names a software rasteriser (G-32). */
export const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software|basic render driver/i;

/** A GPU that is Apple's (Safari names every iPhone, iPad and Mac GPU so). */
export const APPLE_GPU = /\bapple\b/i;

interface WebglProbe {
  /** Whether a WebGL2 context could be made. */
  readonly webgl2: boolean;
  /** The unmasked renderer, or '' where WebGL or the debug extension is missing. */
  readonly renderer: string;
}

let webgl: WebglProbe | undefined;

/** One WebGL probe per session: WebGL2 or not, and the renderer's name. */
export function webglProbe(): WebglProbe {
  if (webgl) return webgl;
  if (typeof document === 'undefined') return { webgl2: false, renderer: '' };
  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    const gl = gl2 ?? canvas.getContext('webgl');
    if (!gl) {
      webgl = { webgl2: false, renderer: '' };
      return webgl;
    }
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info
      ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '')
      : String(gl.getParameter(gl.RENDERER) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    webgl = { webgl2: gl2 !== null, renderer };
  } catch {
    webgl = { webgl2: false, renderer: '' };
  }
  return webgl;
}

/** WebGL's unmasked renderer, or '' where WebGL or the debug extension is missing. */
export function webglRenderer(): string {
  return webglProbe().renderer;
}

let probed: GlassSetting | undefined;

/** The Glass start state: the override's, else Tinted on a software rasteriser, else Clear. */
export function startGlass(): GlassSetting {
  const override = renderOverride();
  if (override && override.glass !== 'auto') return override.glass;
  probed ??= SOFTWARE_RENDERER.test(webglRenderer()) ? 'tinted' : 'clear';
  return probed;
}

/**
 * The ladder's start: step 2 on a small device, else 0. Small is `deviceMemory ≤ 4`; where the
 * memory is unknown, four cores or fewer on a GPU that is not Apple's (GLS-10: every iPhone
 * reports four cores, and the frame monitor decides there).
 */
export function startDegrade(): DegradeStep {
  if (renderOverride()?.degrade === 'off') return 0;
  if (typeof navigator === 'undefined') return 0;
  const memory = (navigator as { deviceMemory?: number }).deviceMemory;
  if (memory !== undefined) return memory <= 4 ? 2 : 0;
  const cores = navigator.hardwareConcurrency;
  if (cores === undefined || cores > 4) return 0;
  return APPLE_GPU.test(webglRenderer()) ? 0 : 2;
}

interface RenderQualityState {
  readonly degrade: DegradeStep;
  /** Takes the next step, if any is left; never back (held for the session). */
  stepDown(): void;
}

export const useRenderQualityStore = create<RenderQualityState>()((set) => ({
  degrade: 0,
  stepDown: () => set((state) => ({ degrade: Math.min(4, state.degrade + 1) as DegradeStep })),
}));

let started = false;

/** Applies the start step once per session (the store keeps any later step). */
export function ensureDegradeStart(): void {
  if (started) return;
  started = true;
  const start = startDegrade();
  if (start > useRenderQualityStore.getState().degrade) {
    useRenderQualityStore.setState({ degrade: start });
  }
}

/** Forgets the session's start (tests). */
export function resetRenderQuality(): void {
  started = false;
  probed = undefined;
  webgl = undefined;
  useRenderQualityStore.setState({ degrade: 0 });
}

/** A disposer with nothing to dispose. */
function noop(): void {
  // The ladder never started.
}

/** The monitor's rule (language.md §2.8, GLS-10): a 2 s window, slow frames, more than 25 %. */
export const LADDER_WINDOW_MS = 2000;
/** A slow frame takes over this, ms, and over 1.5 refresh intervals (`slowFrameMs`). */
export const LADDER_SLOW_FRAME_MS = 20;
export const LADDER_SLOW_SHARE = 0.25;
/** Frames shorter than this never set the refresh interval (no screen refreshes faster). */
const MIN_INTERVAL_MS = 6;
/** Nor longer than this: a screen held at 30 Hz (Safari's Low Power Mode) is the slowest. */
const MAX_INTERVAL_MS = 1000 / 30;

/** The slow-frame threshold for a refresh interval, ms (GLS-10). */
export function slowFrameMs(interval: number): number {
  return Math.max(LADDER_SLOW_FRAME_MS, 1.5 * (Number.isFinite(interval) ? interval : 0));
}
/** Input older than this ends a burst: the monitor stops drawing frames. */
const IDLE_MS = 250;

/**
 * Watches frames while the person scrolls, zooms or pans and steps the ladder down. Returns its
 * disposer. Nothing runs at rest: a burst of input starts the frame loop and it stops itself
 * `IDLE_MS` after the last event, so the idle gate (A-23) sees no frames.
 */
export function startCostLadder(
  step: () => void = () => useRenderQualityStore.getState().stepDown(),
): () => void {
  if (typeof window === 'undefined' || renderOverride()?.degrade === 'off') return noop;
  let raf = 0;
  let last = 0;
  let lastInput = 0;
  let elapsed = 0;
  let frames = 0;
  let slow = 0;
  // The refresh interval: the shortest frame seen this session.
  let interval = Number.POSITIVE_INFINITY;
  const tick = (now: number) => {
    if (last > 0) {
      const delta = now - last;
      if (delta >= MIN_INTERVAL_MS) interval = Math.min(interval, delta, MAX_INTERVAL_MS);
      elapsed += delta;
      frames++;
      if (delta > slowFrameMs(interval)) slow++;
    }
    last = now;
    if (elapsed >= LADDER_WINDOW_MS) {
      if (frames > 0 && slow / frames > LADDER_SLOW_SHARE) step();
      elapsed = 0;
      frames = 0;
      slow = 0;
    }
    if (now - lastInput > IDLE_MS) {
      raf = 0;
      last = 0;
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  const onInput = (event: Event) => {
    if (event.type === 'pointermove' && (event as PointerEvent).buttons === 0) return;
    if (useRenderQualityStore.getState().degrade >= 4) return;
    lastInput = performance.now();
    if (raf === 0) raf = requestAnimationFrame(tick);
  };
  const options: AddEventListenerOptions = { capture: true, passive: true };
  const kinds = ['scroll', 'wheel', 'touchmove', 'pointermove'] as const;
  for (const kind of kinds) window.addEventListener(kind, onInput, options);
  return () => {
    for (const kind of kinds) window.removeEventListener(kind, onInput, options);
    if (raf !== 0) cancelAnimationFrame(raf);
    raf = 0;
  };
}

/** Writes the step onto the root as `materials.css` reads it (absent at 0). */
export function applyDegrade(root: HTMLElement, step: DegradeStep): void {
  if (step > 0) root.setAttribute('data-degrade', String(step));
  else root.removeAttribute('data-degrade');
}

/** How the glass draws (GLS-10): GPU glass, CSS+ or flat. The GPU glass renderer reads it. */
export type GlassRenderTier = 'gpu' | 'css' | 'solid';
/** The GPU glass renderer's name for the same tiers (GLS-13). */
export type GlassTier = GlassRenderTier;

const UNWELCOME = [
  '(prefers-reduced-transparency: reduce)',
  '(prefers-contrast: more)',
  '(forced-colors: active)',
] as const;

const matches = (query: string): boolean =>
  typeof matchMedia === 'function' && matchMedia(query).matches;

/** The Glass setting in force on the root (`data-glass`), or the start state before it. */
function glassInForce(): GlassSetting {
  const value = typeof document === 'undefined' ? null : document.documentElement.dataset.glass;
  return value === 'clear' || value === 'tinted' || value === 'solid' ? value : startGlass();
}

/**
 * Whether the GPU glass may draw (GLS-10): WebGL2, not a software rasteriser, the ladder at
 * step 0, Glass Clear, and no transparency, contrast or forced-colours preference.
 */
export function gpuGlassEligible(): boolean {
  if (typeof document === 'undefined') return false;
  // Test builds force it on a software renderer (GLS-13), compiled out of the deploy build (X36).
  if (OVERRIDE_BUILT && (window as { __rectoGpuGlass?: string }).__rectoGpuGlass === 'force') {
    return useRenderQualityStore.getState().degrade === 0 && glassInForce() === 'clear';
  }
  const { webgl2, renderer } = webglProbe();
  return (
    webgl2 &&
    !SOFTWARE_RENDERER.test(renderer) &&
    useRenderQualityStore.getState().degrade === 0 &&
    glassInForce() === 'clear' &&
    !UNWELCOME.some(matches)
  );
}

/** The glass tier now: `'solid'` under Solid or those preferences, else GPU or CSS+. */
export function glassTier(): GlassRenderTier {
  if (glassInForce() === 'solid' || UNWELCOME.some(matches)) return 'solid';
  return gpuGlassEligible() ? 'gpu' : 'css';
}

/** Calls `listener` whenever the tier may have changed; returns the unsubscribe. */
export function subscribeGlassTier(listener: () => void): () => void {
  const unsubscribe = useRenderQualityStore.subscribe(listener);
  const observer =
    typeof MutationObserver === 'undefined' || typeof document === 'undefined'
      ? undefined
      : new MutationObserver(listener);
  observer?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-glass', 'data-degrade'],
  });
  const queries =
    typeof matchMedia === 'function' ? UNWELCOME.map((query) => matchMedia(query)) : [];
  for (const query of queries) query.addEventListener('change', listener);
  return () => {
    unsubscribe();
    observer?.disconnect();
    for (const query of queries) query.removeEventListener('change', listener);
  };
}

/** The glass tier, kept current (GLS-10). */
export function useGlassTier(): GlassRenderTier {
  return useSyncExternalStore(subscribeGlassTier, glassTier, () => 'css');
}
