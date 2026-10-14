/**
 * Phone form filling's pure part (MOB-1, fill-flow.ts): 44 px targets, the nearest widget
 * where grown targets overlap, the toggle values, the fill bar's stops and the field zoom.
 */
import type { PageId, SourceId } from '@pdf-editor/document-model';
import type { FormField } from '@pdf-editor/engine';
import { describe, expect, it } from 'vitest';

import type { FieldStop } from '../../../../forms/form-store';
import {
  fieldZoom,
  FILL_MAX_ZOOM,
  growTarget,
  MIN_TARGET,
  nearestWidget,
  stepStop,
  takesKeyboard,
  toggleValue,
} from './fill-flow';

const field = (patch: Partial<FormField> & Pick<FormField, 'kind' | 'name'>): FormField =>
  ({
    pageIndex: 0,
    rect: { x: 0, y: 0, width: 10, height: 10 },
    readOnly: false,
    required: false,
    value: undefined,
    ...patch,
  }) as FormField;

const stop = (name: string): FieldStop => ({
  source: 's1' as SourceId,
  name,
  widget: 0,
  pageId: 'p1' as PageId,
  position: 0,
  field: field({ kind: 'text', name }),
});

describe('growTarget', () => {
  it('grows a small widget to 44 px about its centre', () => {
    const t = growTarget({ left: 100, top: 200, width: 10, height: 10 });
    expect(t).toEqual({ left: 83, top: 183, width: MIN_TARGET, height: MIN_TARGET });
  });

  it('keeps a side that is already big enough', () => {
    const t = growTarget({ left: 0, top: 0, width: 200, height: 18 });
    expect(t.width).toBe(200);
    expect(t.left).toBe(0);
    expect(t.height).toBe(MIN_TARGET);
    expect(t.top).toBe(-13);
  });
});

describe('nearestWidget', () => {
  // Two 10 px radios 20 px apart: their grown targets overlap between them.
  const radios = [
    { left: 0, top: 0, width: 10, height: 10 },
    { left: 30, top: 0, width: 10, height: 10 },
  ];

  it('gives a press on a widget to that widget', () => {
    expect(nearestWidget(radios, 5, 5)).toBe(0);
    expect(nearestWidget(radios, 35, 5)).toBe(1);
  });

  it('gives a press in the overlap to the nearer widget', () => {
    expect(nearestWidget(radios, 14, 5)).toBe(0);
    expect(nearestWidget(radios, 26, 5)).toBe(1);
  });

  it('gives nothing outside every target', () => {
    expect(nearestWidget(radios, 5, 60)).toBeUndefined();
  });
});

describe('toggleValue', () => {
  it('flips a check box', () => {
    expect(toggleValue(field({ kind: 'checkbox', name: 'a', value: false }), 'Yes')).toEqual({
      value: true,
    });
    expect(toggleValue(field({ kind: 'checkbox', name: 'a', value: true }), 'Yes')).toEqual({
      value: false,
    });
  });

  it('turns a radio option on, never off', () => {
    const radio = field({ kind: 'radio', name: 'r', value: 'A' });
    expect(toggleValue(radio, 'B')).toEqual({ value: 'B' });
    expect(toggleValue(radio, 'A')).toBeUndefined();
    expect(toggleValue(radio, undefined)).toBeUndefined();
  });

  it('fills nothing read-only, and nothing that is not a toggle', () => {
    expect(
      toggleValue(field({ kind: 'checkbox', name: 'a', readOnly: true }), 'Yes'),
    ).toBeUndefined();
    expect(toggleValue(field({ kind: 'text', name: 't' }), undefined)).toBeUndefined();
  });
});

describe('takesKeyboard', () => {
  it('is text, combo and list boxes', () => {
    expect(takesKeyboard(field({ kind: 'text', name: 't' }))).toBe(true);
    expect(takesKeyboard(field({ kind: 'combobox', name: 'c' }))).toBe(true);
    expect(takesKeyboard(field({ kind: 'listbox', name: 'l' }))).toBe(true);
    expect(takesKeyboard(field({ kind: 'checkbox', name: 'x' }))).toBe(false);
    expect(takesKeyboard(field({ kind: 'signature', name: 's' }))).toBe(false);
  });
});

describe('stepStop', () => {
  const stops = [stop('name'), stop('date'), stop('tried')];

  it('moves forward and back in document order, wrapping round', () => {
    expect(stepStop(stops, stops[0] as FieldStop, 1)?.name).toBe('date');
    expect(stepStop(stops, stops[2] as FieldStop, 1)?.name).toBe('name');
    expect(stepStop(stops, stops[0] as FieldStop, -1)?.name).toBe('tried');
  });

  it('starts at an end from a field that is not a stop', () => {
    expect(stepStop(stops, stop('other'), 1)?.name).toBe('name');
    expect(stepStop(stops, stop('other'), -1)?.name).toBe('tried');
  });

  it('has nowhere to go with one stop or none', () => {
    expect(stepStop([stops[0] as FieldStop], stops[0] as FieldStop, 1)).toBeUndefined();
    expect(stepStop([], stops[0] as FieldStop, 1)).toBeUndefined();
  });
});

describe('fieldZoom', () => {
  it('zooms until the text is 16 px', () => {
    // 8.8 px at fit width: 16 / 8.8 ≈ 1.82.
    expect(fieldZoom({ zoom: 1, fontPx: 8.8, widthPx: 150, viewWidth: 390 })).toBeCloseTo(
      16 / 8.8,
      5,
    );
  });

  it('keeps a zoom that already reads at 16 px', () => {
    expect(fieldZoom({ zoom: 2, fontPx: 18, widthPx: 300, viewWidth: 390 })).toBe(2);
  });

  it('stops at the most it may zoom', () => {
    expect(fieldZoom({ zoom: 1, fontPx: 4, widthPx: 40, viewWidth: 390 })).toBe(FILL_MAX_ZOOM);
  });

  it('keeps a wide field on the screen, never zooming out', () => {
    // 250 px wide: 358 / 250 = 1.432 fits; 16 / 8 = 2 would not.
    expect(fieldZoom({ zoom: 1, fontPx: 8, widthPx: 250, viewWidth: 390 })).toBeCloseTo(1.432, 3);
    expect(fieldZoom({ zoom: 1.5, fontPx: 8, widthPx: 500, viewWidth: 390 })).toBe(1.5);
  });
});
