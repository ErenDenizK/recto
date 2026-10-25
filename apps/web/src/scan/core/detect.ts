/**
 * The detection pipeline (plan bm-scan-plan §2 "Edge detection"): luma, blur, Canny, contour
 * components, page quad. Takes a frame already shrunk to about 480 px (the worker does that) and
 * returns the quad normalised to 0..1 of the frame width and height.
 */
import { canny } from './canny';
import { edgeComponents, type Pt } from './contour';
import { gaussianBlur, sharpness, toLuma, type Frame } from './luma';
import { fitPageQuad } from './quad';

export interface Detection {
  /** Corners (top-left, top-right, bottom-right, bottom-left) as 0..1 shares of the frame, or null. */
  readonly quad: readonly [Pt, Pt, Pt, Pt] | null;
  /** 0 when there is no quad. */
  readonly confidence: number;
  /** Laplacian variance of the frame; the auto-capture gate reads it. */
  readonly sharpness: number;
}

/** Components smaller than this many edge pixels are noise (a page outline has hundreds). */
const MIN_COMPONENT_PIXELS = 60;

export function detectPage(frame: Frame): Detection {
  const { width, height } = frame;
  const luma = toLuma(frame);
  const sharp = sharpness(luma, width, height);
  const edges = canny(gaussianBlur(luma, width, height), width, height);
  const found = fitPageQuad(
    edgeComponents(edges, width, height, MIN_COMPONENT_PIXELS),
    edges,
    width,
    height,
  );
  if (!found) return { quad: null, confidence: 0, sharpness: sharp };
  const quad = found.corners.map((c) => ({ x: c.x / width, y: c.y / height })) as [Pt, Pt, Pt, Pt];
  return { quad, confidence: found.confidence, sharpness: sharp };
}
