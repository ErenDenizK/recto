/**
 * The grid's pieces give way to the capsule (GridPieces.tsx; owner feedback 2026-10-08, F1):
 * full forms while they keep 12 px from it, folded circles where they would come closer, and a
 * rise above the capsule where even a circle would touch.
 */
import { describe, expect, it } from 'vitest';

import { fitPieces, PIECE_CLEARANCE } from './GridPieces';

describe('fitPieces', () => {
  const SCOPE = 264;
  const SIZE = 236;
  const CIRCLE = 44;

  it('keeps both full forms beside a narrow capsule', () => {
    expect(fitPieces(500, 500, SCOPE, SIZE, CIRCLE)).toEqual({
      scopeCompact: false,
      sizeCompact: false,
      raised: false,
    });
  });

  it('folds a piece that would come within 12 px of the capsule', () => {
    const fit = fitPieces(SCOPE + PIECE_CLEARANCE - 1, SIZE + PIECE_CLEARANCE, SCOPE, SIZE, CIRCLE);
    expect(fit).toEqual({ scopeCompact: true, sizeCompact: false, raised: false });
  });

  it('folds both and stays on the line while a circle fits', () => {
    expect(fitPieces(96, 96, SCOPE, SIZE, CIRCLE)).toEqual({
      scopeCompact: true,
      sizeCompact: true,
      raised: false,
    });
  });

  it('rises above the capsule where even a circle would touch it', () => {
    expect(fitPieces(50, 200, SCOPE, SIZE, CIRCLE).raised).toBe(true);
  });
});
