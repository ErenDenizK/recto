import { afterEach, describe, expect, it } from 'vitest';

import { pixelHex, samplePagePixels } from './page-pixels';

afterEach(() => {
  document.body.replaceChildren();
});

/**
 * A page as the Read view builds it: a `data-page-id` sheet holding the page canvas (drawn
 * at twice its CSS size, like a 2× bitmap) and an overlay layer on top that does not draw.
 */
function page(left: number, top: number): { sheet: HTMLElement; canvas: HTMLCanvasElement } {
  const sheet = document.createElement('div');
  sheet.dataset.pageId = 'p1';
  Object.assign(sheet.style, {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: '100px',
    height: '100px',
    background: '#fff',
  });
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 200;
  canvas.dataset.state = 'rendered';
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, 200, 200);
  context.fillStyle = '#336699';
  context.fillRect(100, 100, 100, 100);
  context.fillStyle = '#E0201E';
  context.fillRect(150, 150, 1, 1);
  const overlay = document.createElement('div');
  Object.assign(overlay.style, { position: 'absolute', inset: '0' });
  sheet.append(canvas, overlay);
  document.body.append(sheet);
  return { sheet, canvas };
}

describe('page pixels', () => {
  it('reads the rendered bitmap under a client point, exactly', () => {
    page(20, 30);
    // CSS (95, 105) is bitmap (150, 150): the single red pixel.
    const block = samplePagePixels(20 + 75, 30 + 75);
    expect(block?.centre).toBe('#E0201E');
    expect(block?.size).toBe(11);
    expect(samplePagePixels(20 + 70, 30 + 70)?.centre).toBe('#336699');
    expect(samplePagePixels(20 + 10, 30 + 10)?.centre).toBe('#FFFFFF');
  });

  it('marks the part of the square off the page as transparent', () => {
    page(20, 30);
    const block = samplePagePixels(20, 30)!;
    // The top-left pixel of the square is outside the canvas.
    expect(block.data[3]).toBe(0);
    expect(pixelHex(block.data, 0)).toBeNull();
    expect(block.centre).toBe('#FFFFFF');
  });

  it('returns null off every page', () => {
    page(20, 30);
    expect(samplePagePixels(300, 300)).toBeNull();
  });

  it('prefers a drawn tile over the capped page bitmap', () => {
    const { sheet } = page(20, 30);
    const tiles = document.createElement('div');
    tiles.dataset.testid = 'page-tiles';
    Object.assign(tiles.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    const tile = document.createElement('canvas');
    tile.width = 50;
    tile.height = 50;
    tile.dataset.state = 'rendered';
    Object.assign(tile.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '50px',
      height: '50px',
    });
    const context = tile.getContext('2d')!;
    context.fillStyle = '#00FF00';
    context.fillRect(0, 0, 50, 50);
    tiles.append(tile);
    sheet.append(tiles);
    expect(samplePagePixels(20 + 10, 30 + 10)?.centre).toBe('#00FF00');
    expect(samplePagePixels(20 + 70, 30 + 70)?.centre).toBe('#336699');
  });

  it('composites a translucent pixel over paper white', () => {
    expect(pixelHex(new Uint8ClampedArray([0, 0, 0, 128]), 0)).toBe('#7F7F7F');
  });
});
