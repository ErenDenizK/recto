/**
 * Editing text on phones (EDN-17): the stand-in that holds the keyboard (keyboard-hold.ts) takes
 * the focus synchronously, hands it over to whatever editable takes it next and goes, and lets
 * the keyboard go when nothing does; Edit text registers over its "Soon" stub (edit-text.tsx)
 * and arms the full edition's mode; a tap finds the paragraph under it (edit-text-layer.tsx).
 */
import type { ParagraphBlock } from '@pdf-editor/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pageFrame } from '../../../viewer/page-frame';
import { useToolStore } from '../../../viewer/tool-store';
import { paragraphAt } from './edit-text-layer';
import { HOLD_MAX_MS, holdKeyboard, isHoldingKeyboard, releaseKeyboard } from './keyboard-hold';
import { compactTool } from './registry';
import './tools';
import './edit-text';

const held = () => document.querySelector<HTMLElement>('[data-keyboard-hold]');

describe('holding the keyboard', () => {
  afterEach(() => {
    releaseKeyboard();
    vi.useRealTimers();
  });

  it('focuses an invisible 16 px editable at the tap, at once', () => {
    holdKeyboard({ x: 40, y: 300 });
    const el = held();
    expect(el).not.toBeNull();
    expect(document.activeElement).toBe(el);
    expect(el?.isContentEditable).toBe(true);
    expect(el?.style.fontSize).toBe('16px');
    expect(el?.style.top).toBe('300px');
    expect(el?.getAttribute('aria-hidden')).toBe('true');
    expect(isHoldingKeyboard()).toBe(true);
  });

  it('drops a keystroke: it never takes text', () => {
    holdKeyboard({ x: 0, y: 0 });
    const event = new InputEvent('beforeinput', {
      inputType: 'insertText',
      data: 'a',
      cancelable: true,
    });
    held()?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('hands the focus to the next editable and goes', () => {
    const mirror = document.createElement('div');
    mirror.contentEditable = 'true';
    document.body.append(mirror);
    holdKeyboard({ x: 10, y: 10 });
    mirror.focus();
    expect(document.activeElement).toBe(mirror);
    expect(held()).toBeNull();
    expect(isHoldingKeyboard()).toBe(false);
    mirror.remove();
  });

  it('lets the keyboard go when nothing comes for it', () => {
    vi.useFakeTimers();
    let waiting = true;
    holdKeyboard({ x: 10, y: 10 }, () => waiting);
    vi.advanceTimersByTime(1000);
    expect(isHoldingKeyboard()).toBe(true);
    waiting = false;
    vi.advanceTimersByTime(300);
    expect(held()).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it('lets go at the latest after the longest wait', () => {
    vi.useFakeTimers();
    holdKeyboard({ x: 10, y: 10 }, () => true);
    vi.advanceTimersByTime(HOLD_MAX_MS + 500);
    expect(held()).toBeNull();
  });
});

describe('the Edit text tool', () => {
  it('replaces the "Soon" stub and arms the full edition’s Edit text mode', () => {
    const spec = compactTool('edit-text');
    expect(spec?.soon).toBeFalsy();
    expect(spec?.hint?.()).toBe('Tap a paragraph to change its text.');
    spec?.arm?.('doc' as never);
    expect(useToolStore.getState().mode).toBe('edit-text');
    useToolStore.getState().setMode('select');
  });
});

describe('paragraphAt', () => {
  // An unrotated page at scale 1: user space y grows up, CSS down (page 800 pt tall).
  const frame = pageFrame({
    sourceId: undefined,
    sourceIndex: 0,
    sizePt: { width: 600, height: 800 },
    rotation: 0,
    cssScale: 1,
  });
  const block = (index: number, y: number, refusal?: string) =>
    ({
      ref: { index },
      box: { x: 50, y, width: 300, height: 100 },
      ...(refusal ? { refusal } : {}),
    }) as unknown as ParagraphBlock;

  it('takes the paragraph under the tap, or within a fingertip of it', () => {
    // Box b spans CSS top 800 - 600 - 100 = 100 to 200.
    const blocks = [block(0, 600), block(1, 300)];
    expect(paragraphAt(blocks, frame, { x: 100, y: 150 })?.ref.index).toBe(0);
    expect(paragraphAt(blocks, frame, { x: 100, y: 206 })?.ref.index).toBe(0);
    expect(paragraphAt(blocks, frame, { x: 100, y: 250 })).toBeUndefined();
    expect(paragraphAt(blocks, frame, { x: 100, y: 450 })?.ref.index).toBe(1);
  });

  it('never takes a paragraph that refuses paragraph mode', () => {
    expect(paragraphAt([block(0, 600, 'drop-cap')], frame, { x: 100, y: 150 })).toBeUndefined();
  });
});
