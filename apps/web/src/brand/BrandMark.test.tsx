import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BrandMark } from './BrandMark';
import { MARK_GRADIENT, MARK_PATHS, MARK_VIEWBOX } from './mark';

const fillOf = (svg: SVGSVGElement) => getComputedStyle(svg.querySelector('path') as Element).fill;

describe('BrandMark (docs/brand/README.md "The mark: files and usage")', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
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

  it('is one ink in mono, and auto drops the gradient for the ink in the light theme', () => {
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
    document.documentElement.setAttribute('data-theme', 'light');
    expect(fillOf(auto)).toBe('rgb(1, 2, 3)');
  });
});
