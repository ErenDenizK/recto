/**
 * Render quality (language.md §2.8; ADR-0024 §2.4, §2.5; ADR-0028 §2.1; spec D3-3, X36): the
 * Glass setting's start state, the automatic cost ladder, and the test-only render override.
 *
 * - **Start state.** Until the person picks a Glass setting, Recto starts at Clear, or at Tinted
 *   when WebGL's unmasked renderer names a software rasteriser (SwiftShader, llvmpipe,
 *   "Software", Microsoft Basic Render Driver; G-32): there the blur leaks at the edges and
 *   Tinted keeps text legible over whatever leaks. The probe runs once, on first need.
 * - **Cost ladder,** separate from the setting: while the person scrolls, zooms or pans, a
 *   frame monitor watches 2 s windows of drawn frames; when more than 25 % exceed 20 ms, Recto
 *   takes the next step and holds it for the session: (1) lenses off, (2) Ambient light Still,
 *   (3) M3 surfaces to their solid token, (4) every surface solid. Devices with
 *   `deviceMemory ≤ 4` or `hardwareConcurrency ≤ 4` start at step 2 (G-23, AU-15). The step
 *   reaches CSS as `data-degrade` on the root (absent at 0; `materials.css` reads 3 and 4), the
 *   lens (`styles/material-lens.ts`) and, with D3-8, the light read it here. The monitor draws
 *   frames only while input arrives, so nothing runs at rest (A-23).
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
import { create } from 'zustand';

/** What a person can pick (language.md §2.8). */
export type GlassSetting = 'clear' | 'tinted' | 'solid';

/** The cost ladder's steps: 0 none, then lenses off, light Still, M3 solid, all solid. */
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

/** WebGL's unmasked renderer, or '' where WebGL or the debug extension is missing. */
export function webglRenderer(): string {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return '';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info
      ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '')
      : String(gl.getParameter(gl.RENDERER) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return renderer;
  } catch {
    return '';
  }
}

let probed: GlassSetting | undefined;

/** The Glass start state: the override's, else Tinted on a software rasteriser, else Clear. */
export function startGlass(): GlassSetting {
  const override = renderOverride();
  if (override && override.glass !== 'auto') return override.glass;
  probed ??= SOFTWARE_RENDERER.test(webglRenderer()) ? 'tinted' : 'clear';
  return probed;
}

/** The ladder's start: step 2 on a small device (≤ 4 GB or ≤ 4 cores), else 0. */
export function startDegrade(): DegradeStep {
  if (renderOverride()?.degrade === 'off') return 0;
  if (typeof navigator === 'undefined') return 0;
  const memory = (navigator as { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency;
  const small = (memory !== undefined && memory <= 4) || (cores !== undefined && cores <= 4);
  return small ? 2 : 0;
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
  useRenderQualityStore.setState({ degrade: 0 });
}

/** A disposer with nothing to dispose. */
function noop(): void {
  // The ladder never started.
}

/** The monitor's rule (language.md §2.8): a 2 s window, 20 ms frames, more than 25 %. */
export const LADDER_WINDOW_MS = 2000;
export const LADDER_SLOW_FRAME_MS = 20;
export const LADDER_SLOW_SHARE = 0.25;
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
  const tick = (now: number) => {
    if (last > 0) {
      const delta = now - last;
      elapsed += delta;
      frames++;
      if (delta > LADDER_SLOW_FRAME_MS) slow++;
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
