/**
 * The adaptive look (decisions GLS-9; `adaptive-tone.ts`): the hysteresis, the median, and a
 * piece turning over a page raster in both themes, never under Glass Solid.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { ADAPTIVE_LOOK } from '../../harness/backdrops';
import {
  luminance,
  medianLuminance,
  nextTone,
  TONE_DARK_BELOW,
  TONE_LIGHT_ABOVE,
  updateTones,
} from './adaptive-tone';
import { ADAPTIVE_TIERS } from './materials-css';

const root = document.documentElement;
const saved = { theme: root.getAttribute('data-theme'), glass: root.getAttribute('data-glass') };
let stage: HTMLElement | undefined;

afterEach(() => {
  stage?.remove();
  stage = undefined;
  for (const [name, value] of [
    ['data-theme', saved.theme],
    ['data-glass', saved.glass],
  ] as const) {
    if (value === null) root.removeAttribute(name);
    else root.setAttribute(name, value);
  }
});

/** A page raster of one colour with a bar laid over its top left. */
function scene(fill: string): { bar: HTMLElement; paint: (colour: string) => void } {
  stage = document.createElement('div');
  stage.style.cssText = 'position: fixed; inset: 0; z-index: 9999;';
  const page = document.createElement('div');
  page.setAttribute('data-page-index', '0');
  page.style.cssText = 'position: absolute; left: 0; top: 0; width: 400px; height: 300px;';
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 300;
  canvas.style.cssText = 'display: block; width: 400px; height: 300px;';
  page.append(canvas);
  const bar = document.createElement('div');
  bar.className = 'mat mat-bar s8';
  bar.style.cssText = 'position: absolute; left: 20px; top: 150px; width: 200px; height: 40px;';
  stage.append(page, bar);
  document.body.append(stage);
  const paint = (colour: string) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2D context');
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 400, 300);
  };
  paint(fill);
  return { bar, paint };
}

describe('the adaptive look (GLS-9)', () => {
  it('turns with hysteresis: light above 0.45, dark below 0.20', () => {
    expect(TONE_LIGHT_ABOVE).toBe(0.45);
    expect(TONE_DARK_BELOW).toBe(0.2);
    expect(nextTone('dark', 0.44)).toBe('dark');
    expect(nextTone('dark', 0.46)).toBe('light');
    expect(nextTone('light', 0.21)).toBe('light');
    expect(nextTone('light', 0.19)).toBe('dark');
  });

  it('agrees with the pixel harness and the generator on its tiers and thresholds', () => {
    expect(ADAPTIVE_LOOK.lightAbove).toBe(TONE_LIGHT_ABOVE);
    expect(ADAPTIVE_LOOK.darkBelow).toBe(TONE_DARK_BELOW);
    expect([...ADAPTIVE_LOOK.tiers]).toEqual([...ADAPTIVE_TIERS]);
  });

  it('reads the median luminance of the grid', () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(1, 5);
    expect(luminance(0, 0, 0)).toBe(0);
    // Three white pixels and one black: the median is white's.
    const data = [255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255];
    expect(medianLuminance(data)).toBeCloseTo(1, 5);
  });

  it('turns a dark-theme bar light over a white page and back over a dark one', () => {
    root.setAttribute('data-theme', 'dark');
    root.setAttribute('data-glass', 'clear');
    const { bar, paint } = scene('#ffffff');
    updateTones(false);
    expect(bar.getAttribute('data-theme')).toBe('light');
    paint('#808080');
    updateTones(false);
    // Grey (Y 0.22) is inside the band: the look holds.
    expect(bar.getAttribute('data-theme')).toBe('light');
    paint('#101010');
    updateTones(false);
    expect(bar.hasAttribute('data-theme')).toBe(false);
  });

  it('turns a light-theme bar dark over a dark cover', () => {
    root.setAttribute('data-theme', 'light');
    root.setAttribute('data-glass', 'clear');
    const { bar } = scene('#0b0d10');
    updateTones(false);
    expect(bar.getAttribute('data-theme')).toBe('dark');
  });

  it('keeps the theme’s look under Glass Solid', () => {
    root.setAttribute('data-theme', 'dark');
    root.setAttribute('data-glass', 'clear');
    const { bar } = scene('#ffffff');
    updateTones(false);
    expect(bar.getAttribute('data-theme')).toBe('light');
    root.setAttribute('data-glass', 'solid');
    updateTones(false);
    expect(bar.hasAttribute('data-theme')).toBe(false);
  });
});
