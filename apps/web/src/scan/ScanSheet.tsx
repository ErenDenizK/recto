/**
 * The scan sheet (big move 1, plan bm-scan-plan §3 "Capture screen", DSN-46 entry homes, PRD-32):
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
import { Sheet } from '../ui/sheet';
import { toast } from '../ui/Toast';
import { openCamera, detectionFrame, Detector, jpegOf, stopCamera } from './camera';
import { CornerEditor } from './CornerEditor';
import { Scanner } from './encode';
import { finishScan } from './finish';
import { ReviewStrip } from './ReviewStrip';
import styles from './ScanSheet.module.css';
import {
  addPage,
  closeScanSheet,
  defaultQuad,
  setAuto,
  setQuad,
  setPreview,
  setView,
  toPixels,
  useScanStore,
} from './scan-store';

export const SCAN_SHEET = 'scan';
/** Detection runs about this many times a second (plan §3: 10 to 15 fps). */
const DETECT_INTERVAL_MS = 80;
/** The review's preview, long side px. */
const PREVIEW_SIDE = 900;
/** Flash length, ms; shorter and plain under reduced motion. */
const FLASH_MS = 180;

type CameraStatus = 'starting' | 'live' | 'denied' | 'none' | 'failed';
interface Outline {
  readonly points: string;
  readonly locked: boolean;
}

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

/** Adds each photo as a page; the corners are found on the photo. */
async function addPhotos(files: readonly File[]): Promise<void> {
  const detector = new Detector();
  try {
    for (const file of files) {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      const probe = await createImageBitmap(bitmap);
      bitmap.close();
      const found = await detector.detect(probe);
      const quad =
        (found.quad && toPixels(found.quad, width, height)) ?? defaultQuad(width, height);
      addPage({ source: file, width, height, quad });
    }
  } catch {
    // An unreadable photo is skipped; the others are kept.
  } finally {
    detector.dispose();
  }
  if (useScanStore.getState().pages.length > 0) setView('review');
}

function CameraView({ active }: { readonly active: boolean }) {
  const auto = useScanStore((s) => s.auto);
  const count = useScanStore((s) => s.pages.length);
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CameraStatus>('starting');
  const [size, setSize] = useState({ width: 16, height: 9 });
  const [outline, setOutline] = useState<Outline | null>(null);
  const [flash, setFlash] = useState(0);
  const [generation, setGeneration] = useState(0);
  const latest = useRef<readonly { x: number; y: number }[] | null>(null);
  const armed = useRef(true);
  const capturing = useRef(false);
  const autoRef = useRef(auto);

  // The stream: opened with the sheet, stopped with it and while the page is hidden.
  useEffect(() => {
    const el = video.current;
    let stream: MediaStream | null = null;
    let gone = false;
    void openCamera().then(async (result) => {
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
        await el.play().catch(() => undefined);
      }
      setStatus('live');
    });
    const onVisibility = () => {
      if (document.hidden) {
        stopCamera(stream);
        stream = null;
        if (el) el.srcObject = null;
      } else if (!gone && !stream) {
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
    if (!el || el.videoWidth === 0 || capturing.current) return;
    capturing.current = true;
    try {
      const bitmap = await createImageBitmap(el);
      const { width, height } = bitmap;
      const source = await jpegOf(bitmap);
      bitmap.close();
      const quad = (corners && toPixels(corners, width, height)) ?? defaultQuad(width, height);
      const retaking = useScanStore.getState().retaking !== null;
      addPage({ source, width, height, quad });
      setFlash((n) => n + 1);
      announce(m.scan_announce_captured({ count: useScanStore.getState().pages.length }));
      if (retaking) setView('review');
    } finally {
      capturing.current = false;
      armed.current = false;
    }
  };
  const captureRef = useRef(capture);
  useLayoutEffect(() => {
    autoRef.current = auto;
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
        if (el && el.videoWidth > 0 && el.readyState >= 2) {
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
          if (!result.quad) armed.current = true;
          if (autoRef.current && armed.current && result.stable && !capturing.current) {
            armed.current = false;
            await captureRef.current(result.quad);
            detector.reset();
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
            <PhotoFallback onPhotos={(files) => void addPhotos(files)} />
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
            {status === 'starting' ? (
              <p className={styles.hint}>{m.scan_camera_starting()}</p>
            ) : (
              <p className={styles.hint}>
                {outline?.locked ? m.scan_hint_hold() : m.scan_hint_searching()}
              </p>
            )}
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
            disabled={status !== 'live'}
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
function usePreviews(): void {
  const pages = useScanStore((s) => s.pages);
  const scanner = useRef<Scanner | null>(null);
  const busy = useRef(false);
  const [tick, setTick] = useState(0);
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
          const { blob } = await scanner.current.page(source, stale.quad, {
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

export function ScanSheet() {
  const open = useScanStore((s) => s.open);
  const view = useScanStore((s) => s.view);
  const pages = useScanStore((s) => s.pages);
  const selectedId = useScanStore((s) => s.selected);
  const [busy, setBusy] = useState(false);
  usePreviews();
  const selected = pages.find((p) => p.id === selectedId) ?? pages[pages.length - 1];

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
      onClose={(reason) => {
        // A press beside the sheet must not throw away the pages (nothing typed is lost).
        if (busy || (reason === 'scrim' && useScanStore.getState().pages.length > 0)) return;
        closeScanSheet();
      }}
      primary={{
        label: m.scan_done(),
        onPress: () => void done(),
        disabled: pages.length === 0,
        busy,
        busyLabel: m.scan_done_busy(),
        icon: <Icon name="check" />,
        testId: 'scan-done',
      }}
    >
      {open && (
        <div className={styles.body}>
          <CameraView active={view === 'camera'} />
          {view === 'review' && <ReviewStrip pages={pages} selected={selected} />}
          {view === 'adjust' && selected && (
            <div className={styles.adjust}>
              <CornerEditor
                src={selected.sourceUrl}
                width={selected.width}
                height={selected.height}
                quad={selected.quad}
                onChange={(quad) => setQuad(selected.id, quad)}
              />
              <Button data-testid="scan-adjust-done" onClick={() => setView('review')}>
                {m.scan_adjust_done()}
              </Button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
