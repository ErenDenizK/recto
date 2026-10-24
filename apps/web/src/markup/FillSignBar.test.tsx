/**
 * The Fill & sign bar (`?fillbar=1`, DSN-75): the flag's decision and gate, the stepper's place
 * among the fields, the stepper kept (disabled, with a hint) on a file without fields, and the
 * date's text.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { FieldStop } from '../forms/form-store';
import { resetFormStore } from '../forms/form-store';
import { dateText } from './fill-bar-date';
import { decideFillBar, fillBarShows, resetFillBarFlag } from './fill-bar-flag';
import { FieldStepper, fieldIndex } from './SignGroup';

const stop = (name: string, widget = 0): FieldStop =>
  ({ source: 's', name, widget, pageId: 'p1', position: 0 }) as unknown as FieldStop;
const active = (name: string, widget = 0) => ({ source: 's', name, widget, pageId: 'p1' }) as never;

describe('the flag', () => {
  beforeEach(() => {
    resetFillBarFlag();
    localStorage.clear();
  });
  afterEach(() => {
    history.replaceState(null, '', location.pathname);
    resetFillBarFlag();
    localStorage.clear();
  });

  it('is off unless the address or the stored choice turns it on; ?fillbar=0 wins', () => {
    expect(decideFillBar('', null)).toBe(false);
    expect(decideFillBar('?fillbar=1', null)).toBe(true);
    expect(decideFillBar('', '1')).toBe(true);
    expect(decideFillBar('?fillbar=0', '1')).toBe(false);
    expect(decideFillBar('?fillbar=yes', null)).toBe(false);
  });

  it('shows the bar only on the Fill & sign door with the flag on', () => {
    expect(fillBarShows('sign')).toBe(false);
    expect(fillBarShows('draw')).toBe(false);
    history.replaceState(null, '', `${location.pathname}?fillbar=1`);
    resetFillBarFlag();
    expect(fillBarShows('sign')).toBe(true);
    expect(fillBarShows('draw')).toBe(false);
    expect(localStorage.getItem('pdf-editor:fillbar:v1')).toBe('1');
  });
});

describe('the stepper', () => {
  it('finds the focused field among the stops, else -1', () => {
    const stops = [stop('a'), stop('b'), stop('b', 1)];
    expect(fieldIndex(stops, null)).toBe(-1);
    expect(fieldIndex(stops, active('a'))).toBe(0);
    expect(fieldIndex(stops, active('b', 1))).toBe(2);
    expect(fieldIndex(stops, active('zzz'))).toBe(-1);
  });

  describe('without fields', () => {
    beforeEach(() => resetFormStore());
    afterEach(cleanup);

    it('is absent in the palette', () => {
      const { container } = render(<FieldStepper />);
      expect(container.querySelector('[data-item="stepper"]')).toBeNull();
    });

    it('stays in the bar with disabled steps and the hint', () => {
      render(<FieldStepper always hint="No fields" />);
      // The odometer draws one cell per glyph: the text is read whole.
      expect(document.querySelector('[data-item="stepper"]')?.textContent).toContain('No fields');
      for (const dir of ['previous', 'next']) {
        const button = document.querySelector(`[data-field-step="${dir}"]`);
        expect(button?.getAttribute('aria-disabled')).toBe('true');
      }
    });
  });
});

describe('the date', () => {
  it('is written in the locale, day first', () => {
    const day = new Date(2026, 9, 4);
    expect(dateText(day, 'en')).toBe('04/10/2026');
    expect(dateText(day, 'tr')).toBe('04.10.2026');
  });
});
