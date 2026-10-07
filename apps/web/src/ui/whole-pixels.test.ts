/**
 * Glass on whole pixels (quality-bar Q-2, V2 review item 16): the size a fractional box takes
 * so it rests on whole device pixels, held by an edge or centred, and a live element kept so.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { snapToWholePixels, wholePixelSize } from './whole-pixels';

describe('wholePixelSize', () => {
  it('rounds an edge-held size up to a whole device pixel', () => {
    expect(wholePixelSize(109.3125, 1)).toBe(110);
    expect(wholePixelSize(109.3125, 2)).toBe(109.5);
    // Layout noise just over a whole pixel is not a pixel more.
    expect(wholePixelSize(110.004, 1)).toBe(110);
  });

  it('leaves an even remainder in the container when centred', () => {
    // The dock at 1440: 404.56 px of labels centred in 1438 px of room.
    expect(wholePixelSize(404.5625, 1, 1438)).toBe(406);
    expect(wholePixelSize(404.5625, 1, 1437)).toBe(405);
    // A dialog's 551.81 px in a 900 px window rests at y 174.
    expect((900 - wholePixelSize(551.8125, 1, 900)) / 2).toBe(174);
  });

  it('cannot centre in a container off whole pixels, so only rounds', () => {
    expect(wholePixelSize(404.5625, 1, 1437.5)).toBe(405);
  });
});

describe('snapToWholePixels', () => {
  let dispose: (() => void) | undefined;
  afterEach(() => {
    dispose?.();
    document.body.replaceChildren();
  });

  it('raises the minimum width to whole pixels and follows the content', async () => {
    const box = document.createElement('div');
    box.style.cssText = 'display: inline-block; position: absolute;';
    const inner = document.createElement('div');
    inner.style.cssText = 'width: 100.25px; height: 10px;';
    box.append(inner);
    document.body.append(box);
    dispose = snapToWholePixels(box, 'width');
    expect(box.getBoundingClientRect().width).toBe(101);
    inner.style.width = '120.5px';
    await expect.poll(() => box.getBoundingClientRect().width).toBe(121);
    dispose();
    dispose = undefined;
    expect(box.style.minWidth).toBe('');
  });

  it('leaves a size its maximum holds alone', () => {
    const box = document.createElement('div');
    box.style.cssText = 'position: absolute; max-width: 50.5px; width: 80px; height: 10px;';
    document.body.append(box);
    dispose = snapToWholePixels(box, 'width');
    expect(box.style.minWidth).toBe('');
  });
});
