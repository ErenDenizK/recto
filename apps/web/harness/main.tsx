/**
 * The rendered-pixel harness page (components/09-primitives.md §28, spec 09.11;
 * docs/specs/redesign.md D3-1): one glass surface of the coverage registry over a known
 * backdrop, painted by the app's own `tokens.css`, `reset.css` and `global.css`, so
 * `e2e/glass-pixels.spec.ts` samples the material exactly as the app composes it, with nothing
 * else on the page that could move, animate or carry text.
 *
 * The query (`harness/backdrops.ts`) picks the entry, the backdrop, the Glass setting and the
 * theme. The surface takes the registry's smallest size, carries the material classes its
 * entry gives (`mat mat-<tier> s<σ>`, a one-row menu its menu's classes and `r<σ>`, applied
 * because the surface holds no second child), and sits on whole CSS pixels at the viewport's
 * centre. The root carries what the app's settings would set: `data-theme` and `data-glass`.
 * Fine-pointer σ only: the harness runs on a fine pointer.
 *
 * When the page has painted, `<html data-harness-ready>` is set; a query it cannot render sets
 * `data-harness-error` instead, with the reason as the page's only text.
 */
import '../src/styles/tokens.css';
import '../src/styles/reset.css';
import '../src/styles/global.css';
import './harness.css';

import type { CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';

import {
  COVERAGE_REGISTRY,
  compositionOf,
  entryClasses,
  type GlassSurfaceEntry,
} from '../src/styles/coverage-registry';
import { type Backdrop, BACKDROPS, type GlassMode, surfaceOrigin, type Theme } from './backdrops';

const GLASS_MODES: readonly GlassMode[] = ['clear', 'tinted', 'solid'];
const THEMES: readonly Theme[] = ['dark', 'light'];

interface Scene {
  readonly entry: GlassSurfaceEntry;
  readonly backdrop: Backdrop;
  readonly glass: GlassMode;
  readonly theme: Theme;
}

function readScene(search: string): Scene | string {
  const params = new URLSearchParams(search);
  const entry = COVERAGE_REGISTRY.find((e) => e.id === params.get('entry'));
  if (!entry) return `No coverage registry entry "${params.get('entry') ?? ''}".`;
  const backdrop = BACKDROPS.find((b) => b.name === (params.get('backdrop') ?? 'white'));
  if (!backdrop) return `No backdrop "${params.get('backdrop') ?? ''}".`;
  const glass = (params.get('glass') ?? 'clear') as GlassMode;
  if (!GLASS_MODES.includes(glass)) return `No Glass setting "${glass}".`;
  const theme = (params.get('theme') ?? 'dark') as Theme;
  if (!THEMES.includes(theme)) return `No theme "${theme}".`;
  return { entry, backdrop, glass, theme };
}

/** What the app's settings would set on the root for this scene. */
function applyRoot(scene: Scene): void {
  const root = document.documentElement;
  root.dataset.theme = scene.theme;
  root.dataset.glass = scene.glass;
}

/** The classes the surface carries: a one-row menu's are its menu's and its own `r<σ>`. */
function classesOf(entry: GlassSurfaceEntry): string {
  return (entry.oneRow ? compositionOf(entry.module, entry.selector) : entryClasses(entry)).join(
    ' ',
  );
}

const css = (colour: Backdrop['under']): string =>
  typeof colour === 'string' ? `var(${colour})` : `rgb(${colour.join(' ')})`;

function Harness({ scene, band }: { scene: Scene; band: number }) {
  const { entry, backdrop } = scene;
  const origin = surfaceOrigin(entry.minWidth, entry.minHeight);
  const surface: CSSProperties = {
    left: origin.x,
    top: origin.y,
    width: entry.minWidth,
    height: entry.minHeight,
  };
  return (
    <>
      <div
        className="backdrop"
        style={{ background: css(backdrop.beyond ?? backdrop.under) }}
        data-backdrop={backdrop.name}
      />
      {backdrop.beyond ? (
        <div
          className="band"
          style={{
            left: origin.x - band,
            top: origin.y - band,
            width: entry.minWidth + 2 * band,
            height: entry.minHeight + 2 * band,
            background: css(backdrop.under),
          }}
        />
      ) : null}
      <div
        className={`surface ${classesOf(entry)}`}
        style={surface}
        data-harness-surface={entry.id}
        data-edge-band={backdrop.beyond ? band : undefined}
      />
    </>
  );
}

const scene = readScene(window.location.search);
const container = document.getElementById('root');
if (!container) throw new Error('Root container #root is missing from harness/index.html');

if (typeof scene === 'string') {
  container.textContent = scene;
  document.documentElement.dataset.harnessError = scene;
} else {
  applyRoot(scene);
  // The sharp edge's white band reaches three σ of the surface's own blur (none under Solid): a
  // blur that keeps to its kernel sees only white, so the model holds there.
  const band = scene.glass === 'solid' ? 0 : Math.ceil(3 * scene.entry.sigma);
  createRoot(container).render(<Harness scene={scene} band={band} />);
  // Two frames: React has committed and the compositor has drawn the backdrop filter.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      document.documentElement.dataset.harnessReady = 'true';
    }),
  );
}
