import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { setFenerForTests } from '../state/fener';
import { BrandMark } from './BrandMark';
import {
  MARK_GRADIENT,
  MARK_GRADIENT_FENER_DARK,
  MARK_GRADIENT_FENER_LIGHT,
  MARK_GRADIENT_LIGHT,
  MARK_PATHS,
  MARK_VIEWBOX,
} from './mark';

const fillOf = (svg: SVGSVGElement) => getComputedStyle(svg.querySelector('path') as Element).fill;

describe('BrandMark (docs/brand/README.md "The mark: files and usage")', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    setFenerForTests(null);
  });

  it('draws the two pieces in the tight square, decorative and unfocusable', () => {
    const { container } = render(<BrandMark size={24} />);
    const svg = container.querySelector('svg') as SVGSVGElement;
    expect(svg).toHaveAttribute('viewBox', MARK_VIEWBOX);
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg.getBoundingClientRect().width).toBe(24);
    expect([...svg.querySelectorAll('path')].map((p) => p.getAttribute('d'))).toEqual([
      ...MARK_PATHS,
    ]);
  });

  it('gives every gradient its own id, so two marks on one page never share a paint', () => {
    const { container } = render(
      <>
        <BrandMark tone="gradient" />
        <BrandMark tone="gradient" />
      </>,
    );
    const ids = [...container.querySelectorAll('linearGradient')].map((g) => g.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    const stops = container.querySelectorAll('linearGradient')[0]?.querySelectorAll('stop');
    expect([...(stops ?? [])].map((s) => s.getAttribute('stop-color'))).toEqual(
      MARK_GRADIENT.stops.map((s) => s.color),
    );
  });

  it('is one ink in mono, and auto keeps a gradient in both themes (system audit §3.9)', () => {
    const { container } = render(
      <div style={{ color: 'rgb(1, 2, 3)' }}>
        <BrandMark tone="mono" />
        <BrandMark tone="auto" />
      </div>,
    );
    const [mono, auto] = [...container.querySelectorAll('svg')] as SVGSVGElement[];
    if (!mono || !auto) throw new Error('two marks expected');
    expect(mono.querySelector('linearGradient')).toBeNull();
    expect(fillOf(mono)).toBe('rgb(1, 2, 3)');
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(fillOf(auto)).toMatch(/^url\(/);
    expect(fillOf(auto)).not.toMatch(/-light/);
    document.documentElement.setAttribute('data-theme', 'light');
    expect(fillOf(auto)).toMatch(/^url\(.*-light/);
    const light = auto.querySelectorAll('linearGradient')[1];
    expect(
      [...(light?.querySelectorAll('stop') ?? [])].map((s) => s.getAttribute('stop-color')),
    ).toEqual(MARK_GRADIENT_LIGHT.stops.map((s) => s.color));
  });

  describe('with Fener on (DSN-88)', () => {
    const stopsOf = (gradient: Element | undefined) =>
      [...(gradient?.querySelectorAll('stop') ?? [])].map((s) => s.getAttribute('stop-color'));

    it('draws the indigo, cerulean, green ramp on a light ground and its lifted twin on a dark one', () => {
      setFenerForTests(true);
      const { container } = render(<BrandMark tone="auto" />);
      const [dark, light] = [...container.querySelectorAll('linearGradient')];
      expect(stopsOf(dark)).toEqual(MARK_GRADIENT_FENER_DARK.stops.map((s) => s.color));
      expect(stopsOf(light)).toEqual(MARK_GRADIENT_FENER_LIGHT.stops.map((s) => s.color));
      expect(MARK_GRADIENT_FENER_LIGHT.stops.map((s) => s.color)).toEqual([
        '#3A42D9',
        '#0096C3',
        '#3BCA60',
      ]);
      document.documentElement.setAttribute('data-theme', 'dark');
      expect(fillOf(container.querySelector('svg') as SVGSVGElement)).not.toMatch(/-light/);
      document.documentElement.setAttribute('data-theme', 'light');
      expect(fillOf(container.querySelector('svg') as SVGSVGElement)).toMatch(/-light/);
    });

    it('keeps the geometry, angle and knee of the source in both ramps', () => {
      for (const ramp of [MARK_GRADIENT_FENER_LIGHT, MARK_GRADIENT_FENER_DARK]) {
        expect([ramp.x1, ramp.y1, ramp.x2, ramp.y2]).toEqual([
          MARK_GRADIENT.x1,
          MARK_GRADIENT.y1,
          MARK_GRADIENT.x2,
          MARK_GRADIENT.y2,
        ]);
        expect(ramp.stops.map((s) => s.offset)).toEqual(MARK_GRADIENT.stops.map((s) => s.offset));
      }
    });

    it('holds the stem 3:1 against the dark tile (WCAG 1.4.11) and keeps the dark look bright', () => {
      const ratio = (a: string, b: string) => {
        const lum = (hex: string) => {
          const [r, g, b] = [1, 3, 5].map((i) => {
            const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          }) as [number, number, number];
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
        return (hi + 0.05) / (lo + 0.05);
      };
      const [stem, knee, tip] = MARK_GRADIENT_FENER_DARK.stops.map((s) => s.color);
      // The tile of the app icon: #17191e at the top, #08090c at the foot.
      for (const tile of ['#17191e', '#08090c']) {
        expect(ratio(stem as string, tile), `stem on ${tile}`).toBeGreaterThanOrEqual(3);
        expect(ratio(knee as string, tile), `knee on ${tile}`).toBeGreaterThanOrEqual(3);
        expect(ratio(tip as string, tile), `tip on ${tile}`).toBeGreaterThanOrEqual(3);
      }
      // Lighter stop by stop, as the brand's dark ramp is (teal, mint, lime).
      expect(ratio(stem as string, '#000000')).toBeLessThan(ratio(knee as string, '#000000'));
      expect(ratio(knee as string, '#000000')).toBeLessThan(ratio(tip as string, '#000000'));
      // The hand-tuned light ramp holds the stem 7:1 on white.
      expect(ratio(MARK_GRADIENT_FENER_LIGHT.stops[0].color, '#ffffff')).toBeGreaterThanOrEqual(7);
    });
  });
});
