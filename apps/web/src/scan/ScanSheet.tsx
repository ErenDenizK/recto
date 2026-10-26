/**
 * The scan sheet (big move 1, plan bm-scan-plan §3 "Capture screen", DSN-46 entry homes, PRD-34):
 * one overlay sheet on the Sheet primitive holds the camera, the review and the corner editor, so
 * the stream lives in one mounted place and WebKit does not ask for the camera again (plan §2
 * "Permission"). The video stays mounted under the review (hidden, detection paused) and stops
 * when the sheet closes or the page is hidden.
 *
 * - **Camera.** The rear camera; denied, no camera and failed each say so and offer
 *   `<input type=file accept=image/* capture=environment>`, where the corners are found on the photo.
 * - **Live outline.** The worker's quad over the video, dashed while searching and solid when it
 *   holds (`stable`); frames go to the worker at about 12 per second, 480 px on the long side.
 * - **Capture.** Auto fires when the outline holds, then waits for the page to leave the frame
 *   before it fires again; Manual leaves the shutter. A short flash and a shutter pulse mark it,
 *   a plain brief flash under `reducedMotion()`. Limit: corners are not refined on the full-size
 *   picture (plan §2); the review's corner editor fixes them.
 * - **Done** warps and filters every page (`finish.ts`) and opens one new unsaved document.
 */
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { m } from '../i18n';
import { reducedMotion } from '../motion/reduced-motion';
import { announce } from '../shell/announcer';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';
import { confirm, Sheet } from '../ui/sheet';
import { toast } from '../ui/Toast';
import { openCamera, detectionFrame, Detector, jpegOf, stopCamera } from './camera';
import { CornerEditor } from './CornerEditor';
import { Scanner } from './encode';
import { finishScan } from './finish';
import { useScanOpen } from './scan-flag';
import { ReviewStrip } from './ReviewStrip';
import styles from './ScanSheet.module.css';
import {
  addPage,
  beginScan,
  closeScanSheet,
  defaultQuad,
  insetQuad,
  setAuto,
  setQuad,
  setPreview,
  type ScanPage,
  setView,
  toPixels,
  useScanStore,
} from './scan-store';

export const SCAN_SHEET = 'scan';
/** Detection runs about this many times a second (plan §3: 10 to 15 fps). */
const DETECT_INTERVAL_MS = 80;
/** The review's preview, long side px. */
const PREVIEW_SIDE = 900;
/** How long "Captured" shows, ms. */
const HINT_CAPTURED_MS = 1200;
/** Flash length, ms; shorter and plain under reduced motion. */
const FLASH_MS = 180;

type CameraStatus = 'starting' | 'live' | 'denied' | 'none' | 'failed';
interface Outline {
  readonly points: string;
  readonly locked: boolean;
}

/** A frame that is not ready yet: not an error. */
class SkipFrame extends Error {}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The photo fallback: the device camera app, or the picker where there is none. The input is
 * `FileButton`'s hidden-input pattern with `capture`, which `FileButton` does not carry.
 */
function PhotoFallback({ onPhotos }: { readonly onPhotos: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button icon={<Icon name="image" />} onClick={() => input.current?.click()}>
        {m.scan_photo()}
      </Button>
      <input
        ref={input}
        // eslint-disable-next-line recto/q9-controls
        type="file"
        hidden
        tabIndex={-1}
        aria-hidden="true"
        accept="image/*"
        capture="environment"
        multiple
        data-testid="scan-file"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          if (files.length > 0) onPhotos(files);
        }}
      />
    </>
  );
}

/**
 * What a smaller device holds (EDN-23): the most pages a scan keeps, and the longest side a
 * photo is kept at (a larger one is re-encoded smaller). Without limits nothing is capped.
 */
export interface ScanLimits {
  readonly maxPages?: number;
  readonly photoSide?: number;
}

/** Adds each photo as a page; the corners are found on the photo. */
export async function addPhotos(files: readonly File[], limits: ScanLimits = {}): Promise<void> {
  const room =
    limits.maxPages === undefined
      ? files.length
      : Math.max(0, limits.maxPages - useScanStore.getState().pages.length);
  if (files.length > room && limits.maxPages !== undefined) {
    toast.failure(m.scan_limit_phone({ max: limits.maxPages }), { key: 'scan-limit' });
  }
  const detector = new Detector();
  let skipped = 0;
  try {
    for (const file of files.slice(0, room)) {
      // One unreadable photo (HEIC off Safari) skips only itself.
      try {
        const bitmap = await createImageBitmap(file);
        const probe = await createImageBitmap(bitmap);
        const found = await detector.detect(probe).catch(() => null);
        let { width, height } = bitmap;
        let source: Blob = file;
        const long = Math.max(width, height);
        if (limits.photoSide !== undefined && long > limits.photoSide) {
          const scale = limits.photoSide / long;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
          const small = await createImageBitmap(bitmap, {
            resizeWidth: width,
            resizeHeight: height,
            resizeQuality: 'high',
          });
          source = await jpegOf(small);
          small.close();
        }
        bitmap.close();
        const quad =
          (found?.quad && toPixels(found.quad, width, height)) ?? defaultQuad(width, height);
        addPage({ source, width, height, quad });
      } catch {
        skipped += 1;
      }
    }
  } finally {
    detector.dispose();
  }
  if (skipped > 0) toast.failure(m.scan_photos_skipped({ count: skipped }));
  if (useScanStore.getState().pages.length > 0) setView('review');
}

export function CameraView({
  active,
  limits = {},
}: {
  readonly active: boolean;
  readonly limits?: ScanLimits;
}) {
  const auto = useScanStore((s) => s.auto);
  const count = useScanStore((s) => s.pages.length);
  const retaking = useScanStore((s) => s.retaking !== null);
  // A retake replaces a page, so it fits even at the limit.
  const full = limits.maxPages !== undefined && count >= limits.maxPages && !retaking;
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CameraStatus>('starting');
  const [size, setSize] = useState({ width: 16, height: 9 });
  const [outline, setOutline] = useState<Outline | null>(null);
  const [flash, setFlash] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [captured, setCaptured] = useState(false);
  // An Auto capture is spent until the page leaves the frame: no capture follows, so no "Hold still".
  const [spent, setSpent] = useState(false);
  const latest = useRef<readonly { x: number; y: number }[] | null>(null);
  const armed = useRef(true);
  const capturing = useRef(false);
  const autoRef = useRef(auto);
  const fullRef = useRef(full);

  // The stream: opened with the sheet, stopped with it and while the page is hidden.
  useEffect(() => {
    const el = video.current;
    let stream: MediaStream | null = null;
    let gone = false;
    // Only a camera that was running comes back with the tab: never after denied or missing, so
    // WebKit is not asked again and the photo fallback is not hidden by a restart loop.
    let resume = false;
    void openCamera().then((result) => {
      if (gone) {
        if (result.ok) stopCamera(result.stream);
        return;
      }
      if (!result.ok) {
        setStatus(result.reason);
        return;
      }
      stream = result.stream;
      if (el) {
        el.srcObject = stream;
        // Not awaited: it settles when a frame arrives, which the status does not wait for.
        void el.play().catch(() => undefined);
      }
      setStatus('live');
    });
    const onVisibility = () => {
      if (document.hidden) {
        resume = stream !== null;
        stopCamera(stream);
        stream = null;
        if (el) el.srcObject = null;
      } else if (!gone && !stream && resume) {
        setStatus('starting');
        setGeneration((g) => g + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      gone = true;
      document.removeEventListener('visibilitychange', onVisibility);
      stopCamera(stream);
      if (el) el.srcObject = null;
    };
  }, [generation]);

  const capture = async (corners: readonly { x: number; y: number }[] | null) => {
    const el = video.current;
    if (!el || el.videoWidth === 0 || capturing.current || fullRef.current) return;
    capturing.current = true;
    // The flash and the pulse answer the press, not the encoding; a failure takes them back.
    setFlash((n) => n + 1);
    setCaptured(true);
    try {
      const bitmap = await createImageBitmap(el);
      const { width, height } = bitmap;
      const source = await jpegOf(bitmap);
      bitmap.close();
      const quad = (corners && toPixels(corners, width, height)) ?? defaultQuad(width, height);
      const retaking = useScanStore.getState().retaking !== null;
      addPage({ source, width, height, quad });
      announce(m.scan_announce_captured({ count: useScanStore.getState().pages.length }));
      if (retaking) setView('review');
    } catch {
      setCaptured(false);
      setFlash(0);
      toast.failure(m.scan_capture_failed(), { key: 'scan-capture-failed' });
    } finally {
      capturing.current = false;
      armed.current = false;
      setSpent(true);
    }
  };
  const captureRef = useRef(capture);
  useLayoutEffect(() => {
    autoRef.current = auto;
    fullRef.current = full;
    captureRef.current = capture;
  });

  // Detection: only while the camera shows.
  useEffect(() => {
    if (status !== 'live' || !active) return undefined;
    const detector = new Detector();
    let stop = false;
    void (async () => {
      while (!stop) {
        const started = performance.now();
        const el = video.current;
        try {
          if (!el || el.videoWidth === 0 || el.readyState < 2) throw new SkipFrame();
          if (size.width !== el.videoWidth || size.height !== el.videoHeight) {
            setSize({ width: el.videoWidth, height: el.videoHeight });
          }
          const result = await detector.detect(await detectionFrame(el));
          if (stop) break;
          latest.current = result.quad;
          setOutline(
            result.quad
              ? {
                  points: result.quad.map((p) => `${p.x},${p.y}`).join(' '),
                  locked: result.stable,
                }
              : null,
          );
          if (!result.quad) {
            armed.current = true;
            setSpent(false);
          }
          if (
            autoRef.current &&
            armed.current &&
            result.stable &&
            !capturing.current &&
            !fullRef.current
          ) {
            armed.current = false;
            await captureRef.current(result.quad);
            detector.reset();
          }
        } catch (error) {
          // A frame that fails costs that frame; say so once, and keep looking.
          if (stop) break;
          if (!(error instanceof SkipFrame)) {
            toast.failure(m.scan_detect_failed(), { key: 'scan-detect-failed' });
          }
        }
        await wait(Math.max(0, DETECT_INTERVAL_MS - (performance.now() - started)));
      }
    })();
    return () => {
      stop = true;
      detector.dispose();
      setOutline(null);
    };
    // The loop reads the size from the element; it restarts only with the camera or the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, active]);

  // "Captured" stays about 1.2 s.
  useEffect(() => {
    if (!captured) return undefined;
    const timer = setTimeout(() => setCaptured(false), HINT_CAPTURED_MS);
    return () => clearTimeout(timer);
  }, [captured, flash]);

  // The flash ends by itself; the key restarts it for the next capture.
  useEffect(() => {
    if (flash === 0) return undefined;
    const timer = setTimeout(() => setFlash(0), reducedMotion() ? 100 : FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  const unavailable = status === 'denied' || status === 'none' || status === 'failed';

  return (
    <div className={styles.camera} hidden={!active}>
      <div className={styles.viewport}>
        {unavailable ? (
          <div className={styles.unavailable} role="status" data-testid={`scan-${status}`}>
            <Icon name="scan" />
            <p>
              {status === 'denied'
                ? m.scan_denied()
                : status === 'none'
                  ? m.scan_none()
                  : m.scan_failed()}
            </p>
            <PhotoFallback onPhotos={(files) => void addPhotos(files, limits)} />
          </div>
        ) : (
          <div
            className={styles.frame}
            style={{ '--ar': size.width / size.height } as CSSProperties}
            aria-label={m.scan_camera_view()}
          >
            <video
              ref={video}
              className={styles.video}
              muted
              playsInline
              data-testid="scan-video"
            />
            <svg
              className={styles.outline}
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {outline && (
                <polygon
                  points={outline.points}
                  strokeWidth={3}
                  data-locked={outline.locked || undefined}
                  data-testid="scan-outline"
                />
              )}
            </svg>
            {flash > 0 && (
              <div
                key={flash}
                className={styles.flash}
                data-reduced={reducedMotion() || undefined}
                aria-hidden="true"
              />
            )}
            <p className={styles.hint} data-testid="scan-hint">
              {status === 'starting'
                ? m.scan_camera_starting()
                : full
                  ? m.scan_limit_phone({ max: limits.maxPages ?? 0 })
                  : captured || (auto && spent && outline)
                    ? m.scan_hint_captured()
                    : outline
                      ? auto
                        ? m.scan_hint_hold()
                        : m.scan_hint_shutter()
                      : m.scan_hint_searching()}
            </p>
          </div>
        )}
      </div>
      {!unavailable && (
        <div className={styles.controls}>
          <Segmented
            label={m.scan_mode()}
            value={auto ? 'auto' : 'manual'}
            onValueChange={(value) => setAuto(value === 'auto')}
            options={[
              { value: 'auto', label: m.scan_mode_auto() },
              { value: 'manual', label: m.scan_mode_manual() },
            ]}
          />
          <button
            key={flash}
            type="button"
            // The shutter is a camera control, not an action capsule (Q-14).
            // eslint-disable-next-line recto/q9-controls
            className={styles.shutter}
            data-pulse={flash > 0 && !reducedMotion() ? '' : undefined}
            aria-label={m.scan_shutter()}
            disabled={status !== 'live' || full}
            data-testid="scan-shutter"
            onClick={() => void capture(latest.current)}
          />
          {count > 0 ? (
            <Button
              icon={<Icon name="stack" />}
              aria-label={m.scan_stack({ count })}
              data-testid="scan-stack"
              onClick={() => setView('review')}
            >
              {count}
            </Button>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}

/** Makes each page's small preview, one at a time, as pages and choices change. */
export function usePreviews(open: boolean): void {
  const pages = useScanStore((s) => s.pages);
  const scanner = useRef<Scanner | null>(null);
  const busy = useRef(false);
  const [tick, setTick] = useState(0);
  // The warp's GL context goes with the sheet, not with the page.
  useEffect(() => {
    if (open) return undefined;
    scanner.current?.dispose();
    scanner.current = null;
    return undefined;
  }, [open]);
  useEffect(
    () => () => {
      scanner.current?.dispose();
      scanner.current = null;
    },
    [],
  );
  useEffect(() => {
    const stale = pages.find((p) => p.previewRev !== p.rev);
    if (!stale || busy.current) return;
    busy.current = true;
    void (async () => {
      try {
        scanner.current ??= new Scanner();
        const source = await createImageBitmap(stale.source);
        try {
          const { blob } = await scanner.current.page(source, insetQuad(stale.quad), {
            filter: stale.filter,
            longSide: PREVIEW_SIDE,
            quality: 0.8,
          });
          setPreview(stale.id, stale.rev, URL.createObjectURL(blob));
        } finally {
          source.close();
        }
      } catch {
        // No preview: the page keeps its placeholder and Done still tries the full warp.
        setPreview(stale.id, stale.rev, '');
      } finally {
        busy.current = false;
        // A change made meanwhile left a page stale: look again.
        setTick((t) => t + 1);
      }
    })();
  }, [pages, tick]);
}

/** Corner adjust with its own Apply, and Back, which puts the corners back as they were. */
export function AdjustView({ page }: { readonly page: ScanPage }) {
  const [original] = useState(page.quad);
  return (
    <div className={styles.adjust}>
      <CornerEditor
        src={page.sourceUrl}
        width={page.width}
        height={page.height}
        quad={page.quad}
        onChange={(quad) => setQuad(page.id, quad)}
      />
      <div className={styles.adjustBar}>
        <Button
          data-testid="scan-adjust-back"
          onClick={() => {
            setQuad(page.id, original);
            setView('review');
          }}
        >
          {m.scan_back()}
        </Button>
        <Button
          variant="prominent"
          data-testid="scan-adjust-done"
          onClick={() => setView('review')}
        >
          {m.scan_apply()}
        </Button>
      </div>
    </div>
  );
}

export function ScanSheet() {
  const open = useScanOpen();
  const view = useScanStore((s) => s.view);
  const pages = useScanStore((s) => s.pages);
  const selectedId = useScanStore((s) => s.selected);
  const [busy, setBusy] = useState(false);
  usePreviews(open);
  useEffect(() => {
    if (open) beginScan();
  }, [open]);
  const selected = pages.find((p) => p.id === selectedId) ?? pages[pages.length - 1];

  // Esc, Cancel, the close button and the scrim ask first when pages would be lost.
  const asking = useRef(false);
  const close = async () => {
    const count = useScanStore.getState().pages.length;
    if (busy || asking.current) return;
    if (count > 0) {
      asking.current = true;
      const discard = await confirm({
        title: count === 1 ? m.scan_discard_title_one() : m.scan_discard_title({ count }),
        body: m.scan_discard_body(),
        action: m.scan_discard(),
        danger: true,
      });
      asking.current = false;
      if (!discard) return;
    }
    closeScanSheet();
  };

  const done = async () => {
    setBusy(true);
    try {
      if (await finishScan(pages)) closeScanSheet();
      else toast.failure(m.scan_finish_failed());
    } catch {
      toast.failure(m.scan_finish_failed());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      id={SCAN_SHEET}
      kind="overlay"
      open={open}
      testId="scan-sheet"
      title={m.scan_title()}
      busy={busy}
      onClose={() => void close()}
      // The corner editor has its own Apply and Back; the sheet's Cancel and Done wait.
      primary={
        view === 'adjust'
          ? undefined
          : {
              label: m.scan_done(),
              onPress: () => void done(),
              disabled: pages.length === 0,
              busy,
              busyLabel: m.scan_done_busy(),
              icon: <Icon name="check" />,
              testId: 'scan-done',
            }
      }
    >
      {open && (
        <div className={styles.body}>
          <CameraView active={view === 'camera'} />
          {view === 'review' && <ReviewStrip pages={pages} selected={selected} />}
          {view === 'adjust' && selected && <AdjustView page={selected} />}
        </div>
      )}
    </Sheet>
  );
}
