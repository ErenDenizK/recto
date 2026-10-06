/**
 * The rendered-pixel harness page (components/09-primitives.md §28, spec 09.11;
 * docs/specs/redesign.md D3-1): one glass surface of the coverage registry over a known
 * backdrop, painted by the app's own `tokens.css`, `reset.css` and `global.css`, so
 * `e2e/glass-pixels.spec.ts` samples the material exactly as the app composes it, with nothing
 * else on the page that could move, animate or carry text.
 *
 * The query (`harness/backdrops.ts`) picks the entry, the backdrop, the Glass setting and the
 * theme. The surface takes the registry's smallest size, composes the classes its module
 * composes, takes the entry's filter token where it is not its composition's own (the one-row
 * menus' `--glass-menu-short-filter`, as `ui/Menu.module.css` does), and sits on whole CSS
 * pixels at the viewport's centre. The root carries what the app's settings would set:
 * `data-theme`, `data-glass`, Solid as `data-transparency='reduced'` (today's switch), and
 * `data-glass-panels` for the docked frame, whose glass exists only with that setting on.
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
  type GlassComposition,
  type GlassFilterToken,
  type GlassSurfaceEntry,
} from '../src/styles/coverage-registry';
import { type Backdrop, BACKDROPS, type GlassMode, surfaceOrigin, type Theme } from './backdrops';

/** The filter each composition's global rule reads (`styles/global.css`). */
const OWN_FILTER: Record<GlassComposition, GlassFilterToken> = {
  glass: '--glass-filter',
  'glass glass-menu': '--glass-menu-backdrop',
  'glass-frame': '--glass-frame-filter',
};

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
  if (entry.composes === 'glass-frame' && entry.filter !== OWN_FILTER['glass-frame']) {
    return `The docked frame reads only ${OWN_FILTER['glass-frame']}.`;
  }
  return { entry, backdrop, glass, theme };
}

/** What the app's settings would set on the root for this scene. */
function applyRoot(scene: Scene): void {
  const root = document.documentElement;
  root.dataset.theme = scene.theme;
  root.dataset.glass = scene.glass;
  if (scene.glass === 'solid') root.dataset.transparency = 'reduced';
  if (scene.entry.composes === 'glass-frame') root.setAttribute('data-glass-panels', '');
}

/** `blur(σ)` of a filter value, 0 for `none`. */
function blurOf(filter: string): number {
  const match = /blur\(\s*([\d.]+)px\s*\)/.exec(filter);
  return match ? Number(match[1]) : 0;
}

const css = (colour: Backdrop['under']): string =>
  typeof colour === 'string' ? `var(${colour})` : `rgb(${colour.join(' ')})`;

function Harness({ scene, band }: { scene: Scene; band: number }) {
  const { entry, backdrop } = scene;
  const origin = surfaceOrigin(entry.minWidth, entry.minHeight);
  const surface: CSSProperties & Record<`--${string}`, string> = {
    left: origin.x,
    top: origin.y,
    width: entry.minWidth,
    height: entry.minHeight,
  };
  if (entry.filter !== OWN_FILTER[entry.composes])
    surface['--glass-filter'] = `var(${entry.filter})`;
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
        className={`surface ${entry.composes}`}
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
  // The sharp edge's white band reaches three σ of the surface's own blur, read from its filter
  // token as this scene resolves it (none under Solid): a blur that keeps to its kernel sees
  // only white, so the model holds there.
  const filter = getComputedStyle(document.documentElement).getPropertyValue(scene.entry.filter);
  const band = Math.ceil(3 * blurOf(filter));
  createRoot(container).render(<Harness scene={scene} band={band} />);
  // Two frames: React has committed and the compositor has drawn the backdrop filter.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      document.documentElement.dataset.harnessReady = 'true';
    }),
  );
}
