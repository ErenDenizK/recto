/**
 * Fener's focus ring on real elements (DSN-88): the computed ring of a focused button is the
 * theme colour between two ink bands, and white between them on a control the theme colour
 * fills (the primary button), in both themes and all three presets.
 */
import './tokens.css';
import './fener.css';
import './reset.css';
import './global.css';

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { FENER_PRESETS } from '../state/fener';

afterEach(() => {
  for (const name of ['data-fener', 'data-accent', 'data-theme']) {
    document.documentElement.removeAttribute(name);
  }
  document.body.replaceChildren();
});

const rgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
/** The light theme's fills (Mor and Mavi deeper than the dark theme's, for white type). */
const FILL: Record<string, string> = { indigo: '#4650fb', violet: '#783cee', blue: '#0a6ab5' };
const RING_DARK: Record<string, string> = { indigo: '#8a9ff2', violet: '#a794f2', blue: '#61aaf2' };

describe.each(['light', 'dark'] as const)('the %s theme', (theme) => {
  describe.each(FENER_PRESETS)('%s', (preset) => {
    function mount() {
      const root = document.documentElement;
      root.setAttribute('data-theme', theme);
      root.setAttribute('data-fener', '');
      root.setAttribute('data-accent', preset);
      render(
        <div>
          <button type="button" className="btn btn-prominent">
            Save
          </button>
          <button type="button" className="btn btn-standard">
            Other
          </button>
        </div>,
      );
    }

    it('is white between ink bands on the primary button, outset (2 · 2 · 2)', async () => {
      mount();
      await userEvent.tab();
      const button = screen.getByRole('button', { name: 'Save' });
      expect(document.activeElement).toBe(button);
      const style = getComputedStyle(button);
      expect(style.outlineColor).toBe(theme === 'light' ? 'rgb(255, 255, 255)' : rgb('#f4f6ff'));
      expect(style.outlineWidth).toBe('2px');
      expect(style.boxShadow).toContain(rgb('#08090c'));
      expect(style.boxShadow).toMatch(/0px 0px 0px 6px/);
    });

    it('is the theme colour between ink bands on a neutral button', async () => {
      mount();
      await userEvent.tab();
      await userEvent.tab();
      const button = screen.getByRole('button', { name: 'Other' });
      expect(document.activeElement).toBe(button);
      const style = getComputedStyle(button);
      expect(style.outlineColor).toBe(
        rgb(theme === 'light' ? (FILL[preset] ?? '') : (RING_DARK[preset] ?? '')),
      );
      expect(style.boxShadow).toContain(rgb('#08090c'));
    });
  });
});
