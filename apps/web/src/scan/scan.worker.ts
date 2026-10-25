/**
 * The scan detector worker (plan bm-scan-plan §2 "Edge detection (TS, in a worker)"). One message
 * per camera frame, `{ type: 'detect', id, frame }` with `frame` an `ImageBitmap` (transferred) or
 * an `ImageData`, answered with `{ type: 'result', id, quad, confidence, stable, sharpness }`:
 * the page quad as four corners normalised to 0..1 (top-left, top-right, bottom-right,
 * bottom-left) or null, how page-like it is, and whether it has held still long enough to
 * auto-capture (`core/stability.ts`). `{ type: 'reset' }` forgets the hold (a new page).
 *
 * The frame is shrunk to `DETECT_SIZE` px on its long side before detection. A frame that cannot
 * be read answers with no quad rather than an error, so a live loop keeps running.
 */
import { detectPage } from './core/detect';
import type { Pt } from './core/contour';
import { createStabilityTracker, MIN_CONFIDENCE, type StabilityTracker } from './core/stability';

export const DETECT_SIZE = 480;

export interface DetectRequest {
  readonly type: 'detect';
  readonly id: number;
  readonly frame: ImageBitmap | ImageData;
}

export interface ResetRequest {
  readonly type: 'reset';
}

export interface DetectResult {
  readonly type: 'result';
  readonly id: number;
  readonly quad: readonly [Pt, Pt, Pt, Pt] | null;
  readonly confidence: number;
  readonly stable: boolean;
  readonly sharpness: number;
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<DetectRequest | ResetRequest>) => void) | null;
  postMessage(message: DetectResult): void;
};

let tracker: StabilityTracker | null = null;
let trackerSize = '';

async function shrink(frame: ImageBitmap | ImageData): Promise<ImageData> {
  const source = 'data' in frame ? await createImageBitmap(frame) : frame;
  try {
    const scale = Math.min(1, DETECT_SIZE / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const ctx = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(source, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  } finally {
    source.close();
  }
}

async function detect(request: DetectRequest): Promise<DetectResult> {
  const { id } = request;
  try {
    const small = await shrink(request.frame);
    const size = `${small.width}x${small.height}`;
    if (!tracker || size !== trackerSize) {
      tracker = createStabilityTracker(Math.hypot(small.width, small.height));
      trackerSize = size;
    }
    const found = detectPage(small);
    const stable = tracker.push(
      found.quad && found.confidence >= MIN_CONFIDENCE
        ? found.quad.map((c) => ({ x: c.x * small.width, y: c.y * small.height }))
        : null,
      found.sharpness,
      performance.now(),
    );
    return { type: 'result', id, ...found, stable };
  } catch {
    tracker?.reset();
    return { type: 'result', id, quad: null, confidence: 0, stable: false, sharpness: 0 };
  }
}

scope.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'reset') tracker?.reset();
  else void detect(message).then((result) => scope.postMessage(result));
};
