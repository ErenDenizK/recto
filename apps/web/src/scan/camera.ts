/**
 * The camera and the frame plumbing of the scan (plan bm-scan-plan §2 "Camera" and "Edge
 * detection"): `getUserMedia` for the rear camera with the denied and no-camera answers named,
 * frame grabs (a 480 px one for the worker, a full one for the picture), JPEG encoding, and a
 * promise wrapper over the detection worker (`scan.worker.ts`: normalised corners, confidence,
 * stable, sharpness). Frames never leave the device (`connect-src 'self'`).
 */
import type { DetectResult } from './scan.worker';

export type CameraResult =
  | { readonly ok: true; readonly stream: MediaStream }
  | { readonly ok: false; readonly reason: 'denied' | 'none' | 'failed' };

/** Asks for the rear camera, as large as it goes (plan §2: 1080p to 4K). */
export async function openCamera(): Promise<CameraResult> {
  const devices = navigator.mediaDevices as MediaDevices | undefined;
  if (!devices?.getUserMedia) return { ok: false, reason: 'none' };
  try {
    const stream = await devices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 } },
      audio: false,
    });
    return { ok: true, stream };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return { ok: false, reason: 'denied' };
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return { ok: false, reason: 'none' };
    }
    return { ok: false, reason: 'failed' };
  }
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/** The long side of a detection frame, px (plan §2). */
const DETECT_SIDE = 480;

/** The current video frame shrunk for detection. */
export function detectionFrame(video: HTMLVideoElement): Promise<ImageBitmap> {
  const landscape = video.videoWidth >= video.videoHeight;
  return createImageBitmap(video, {
    ...(landscape ? { resizeWidth: DETECT_SIDE } : { resizeHeight: DETECT_SIDE }),
    resizeQuality: 'low',
  });
}

/** JPEG bytes of a bitmap. */
export async function jpegOf(bitmap: ImageBitmap, quality = 0.92): Promise<Blob> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  (canvas.getContext('2d') as OffscreenCanvasRenderingContext2D).drawImage(bitmap, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  canvas.width = 0;
  return blob;
}

/** The detection worker as a promise: one frame in, its corners out. */
export class Detector {
  private readonly worker = new Worker(new URL('./scan.worker.ts', import.meta.url), {
    type: 'module',
    name: 'scan-detect',
  });
  private readonly waiting = new Map<
    number,
    { resolve: (result: DetectResult) => void; reject: (error: Error) => void }
  >();
  private next = 0;
  private failed = false;

  constructor() {
    this.worker.onmessage = (event: MessageEvent<DetectResult>) => {
      const done = this.waiting.get(event.data.id);
      this.waiting.delete(event.data.id);
      done?.resolve(event.data);
    };
    this.worker.onerror = () => {
      this.failed = true;
      this.rejectAll('The detection worker failed.');
    };
  }

  /** Takes the bitmap (it is transferred). */
  detect(frame: ImageBitmap): Promise<DetectResult> {
    if (this.failed) return Promise.reject(new Error('The detection worker failed.'));
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'detect', id, frame }, [frame]);
    });
  }

  /** Forget the hold: the next page starts a fresh stability count. */
  reset(): void {
    this.worker.postMessage({ type: 'reset' });
  }

  private rejectAll(message: string): void {
    const pending = [...this.waiting.values()];
    this.waiting.clear();
    for (const { reject } of pending) reject(new Error(message));
  }

  dispose(): void {
    this.worker.terminate();
    this.rejectAll('The detector was disposed.');
  }
}
