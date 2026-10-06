/**
 * The zoom controller (05-canvas §4; spec D2-10): the rubber band and the grid threshold,
 * projection and detents, the anchor maths, and the controller over a fake host (the gesture
 * writes only transforms; one commit at rest with the anchor where it showed; the Pages grid;
 * notches and their pause rule; the double tap; a gesture grabbing a settle).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bandedZoom,
  createZoomController,
  DETENT_REACH,
  detentOf,
  gridArmed,
  type LayerTransform,
  NOTCH_FACTOR,
  type Point,
  pointUnder,
  releaseRest,
  smartZoomRest,
  transformAbout,
  type ZoomBounds,
  type ZoomHost,
  type ZoomRest,
} from './zoom-controller';

afterEach(() => {
  delete document.documentElement.dataset.motion;
});

const BOUNDS: ZoomBounds = { zoom: 1.2, min: 0.25, max: 5, fitWidth: 1.2, fitPage: 0.6 };

describe('the maths', () => {
  it('tracks 1:1 inside the limits and rubber-bands at most 19 % past them', () => {
    expect(bandedZoom(1, 0.6, 5)).toBe(1);
    expect(bandedZoom(0.6, 0.6, 5)).toBeCloseTo(0.6, 9);
    const below = bandedZoom(0.1, 0.6, 5);
    expect(below).toBeLessThan(0.6);
    expect(below).toBeGreaterThan(0.6 * 2 ** -0.25);
    const above = bandedZoom(40, 0.6, 5);
    expect(above).toBeGreaterThan(5);
    expect(above).toBeLessThan(5 * 2 ** 0.25);
    // Monotonic: more pinch, more zoom, even past the limit.
    expect(bandedZoom(0.4, 0.6, 5)).toBeGreaterThan(bandedZoom(0.3, 0.6, 5));
  });

  it('holds the limit without a rubber band under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';
    expect(bandedZoom(0.1, 0.6, 5)).toBeCloseTo(0.6, 9);
    expect(bandedZoom(40, 0.6, 5)).toBeCloseTo(5, 9);
  });

  it('arms the grid more than 15 % below the soft limit', () => {
    expect(gridArmed(0.6 * 0.86, 0.6)).toBe(false);
    expect(gridArmed(0.6 * 0.84, 0.6)).toBe(true);
  });

  it('snaps to the nearest detent within 6 %', () => {
    expect(detentOf(1.2 * 1.05, BOUNDS)).toEqual({ zoom: 1.2, fit: 'width' });
    expect(detentOf(0.6 / 1.05, BOUNDS)).toEqual({ zoom: 0.6, fit: 'page' });
    expect(detentOf(1.04, BOUNDS)).toEqual({ zoom: 1, fit: null });
    expect(detentOf(1.2 * (1 + DETENT_REACH) * 1.01, BOUNDS)).toBeNull();
    // Between 100 % and fit width, the nearer one wins.
    expect(detentOf(1.13, { ...BOUNDS, fitWidth: 1.1 })?.fit).toBe('width');
  });

  it('projects the release velocity with r 0.99, then clamps and snaps', () => {
    // Still: rests where it is (snapped).
    expect(releaseRest(2, 0, BOUNDS, 0.6)).toEqual({ zoom: 2, fit: null });
    // A flick out of 2 log2-units per second: 2^(-2 · 0.099) ≈ 0.87 of the zoom.
    const flung = releaseRest(2, -2, BOUNDS, 0.6);
    expect(flung?.zoom).toBeCloseTo(2 * 2 ** ((-2 / 1000) * (0.99 / 0.01)), 6);
    // A flick into 100 %'s reach snaps there.
    expect(releaseRest(1.2, -2.5, { ...BOUNDS, fitWidth: 2 }, 0.6)).toEqual({ zoom: 1, fit: null });
    // Never past the hard limit, nor below the soft one.
    expect(releaseRest(4.8, 20, BOUNDS, 0.6)?.zoom).toBe(5);
    expect(releaseRest(0.58, -20, BOUNDS, 0.6)).toEqual({ zoom: 0.6, fit: 'page' });
    // Past 15 % below the soft limit: the grid.
    expect(releaseRest(0.5, 0, BOUNDS, 0.6)).toBeNull();
  });

  it('has no momentum under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';
    expect(releaseRest(2, -2, BOUNDS, 0.6)).toEqual({ zoom: 2, fit: null });
  });

  it('keeps a point under the same spot through a transform', () => {
    const p = { x: 300, y: 1200 };
    const t = transformAbout(p, { x: 150, y: 400 }, 1.7);
    expect(t.x + t.scale * p.x).toBeCloseTo(150, 9);
    expect(t.y + t.scale * p.y).toBeCloseTo(400, 9);
    const back = pointUnder({ x: 150, y: 400 }, t);
    expect(back.x).toBeCloseTo(300, 9);
    expect(back.y).toBeCloseTo(1200, 9);
  });

  it('double tap: fit width ⇄ 250 %', () => {
    expect(smartZoomRest(1.2, BOUNDS)).toEqual({ zoom: 2.5, fit: null });
    expect(smartZoomRest(0.6, BOUNDS)).toEqual({ zoom: 2.5, fit: null });
    expect(smartZoomRest(2.5, BOUNDS)).toEqual({ zoom: 1.2, fit: 'width' });
  });
});

/** A host whose layer coordinates equal client coordinates (no scroll, no offset). */
function fakeHost(bounds: ZoomBounds = BOUNDS) {
  const transforms: (LayerTransform | null)[] = [];
  const host = {
    bounds: vi.fn(() => bounds),
    toLayer: (client: Point) => client,
    prepare: vi.fn<(minScale: number) => void>(),
    transform: vi.fn((t: LayerTransform | null) => {
      transforms.push(t);
    }),
    landing: vi.fn((_zoom: number, _p: Point, at: Point) => at),
    commit: vi.fn<(rest: ZoomRest, p: Point, at: Point) => void>(),
    chip: vi.fn<(shown: boolean, at: Point, haptic: boolean) => void>(),
    enterGrid: vi.fn<(p: Point) => void>(),
  } satisfies ZoomHost;
  return { host, transforms, controller: createZoomController(host) };
}

const at = (x: number, y: number) => ({ x, y });
const shownAt = (t: LayerTransform | null | undefined, p: Point) =>
  t ? { x: t.x + t.scale * p.x, y: t.y + t.scale * p.y } : p;

describe('createZoomController', () => {
  it('pinches by transform about the fingers, then commits once with the anchor in place', async () => {
    const { host, transforms, controller } = fakeHost();
    controller.start(at(400, 300), true);
    expect(host.prepare).toHaveBeenCalledTimes(1);
    for (let i = 1; i <= 10; i++) controller.change(1 + i / 20, at(400 + i, 300));
    // Only transforms during the pinch: the point under the fingers follows them.
    expect(host.commit).not.toHaveBeenCalled();
    const last = transforms.at(-1);
    expect(last?.scale).toBeCloseTo(1.5, 9);
    const p = { x: 400, y: 300 };
    expect(shownAt(last, p).x).toBeCloseTo(410, 9);
    expect(host.prepare).toHaveBeenCalledTimes(1);

    controller.end(1.5, 0, at(410, 300));
    await vi.waitFor(() => expect(host.commit).toHaveBeenCalledTimes(1));
    const [rest, anchor, landing] = host.commit.mock.calls[0] ?? [];
    expect(rest?.zoom).toBeCloseTo(1.8, 9);
    expect(rest?.fit).toBeNull();
    expect(anchor?.x).toBeCloseTo(400, 6);
    expect(landing).toEqual(at(410, 300));
    // The settle's last frame shows the anchor exactly where the commit puts it.
    expect(shownAt(transforms.at(-1), p).x).toBeCloseTo(410, 6);
    expect(transforms.at(-1)?.scale).toBeCloseTo(1.5, 6);
    expect(controller.busy).toBe(false);
  });

  it('shows the chip past 15 % below fit page and opens the grid on release', () => {
    const { host, controller } = fakeHost({ ...BOUNDS, zoom: 0.6 });
    controller.start(at(300, 300), true);
    controller.change(0.9, at(300, 300));
    expect(host.chip).not.toHaveBeenCalled();
    controller.change(0.8, at(300, 300));
    controller.change(0.7, at(300, 300));
    expect(host.chip).toHaveBeenCalledTimes(1);
    expect(host.chip).toHaveBeenCalledWith(true, at(300, 300), true);
    // Rubber band: the layer never shows less than 19 % below fit page.
    controller.end(0.7, 0, at(300, 300));
    expect(host.chip).toHaveBeenLastCalledWith(false, at(300, 300), false);
    expect(host.enterGrid).toHaveBeenCalledWith(at(300, 300));
    expect(host.commit).not.toHaveBeenCalled();
    expect(controller.busy).toBe(false);
  });

  it('a pinch back above the threshold hides the chip and settles at fit page', async () => {
    const { host, controller } = fakeHost({ ...BOUNDS, zoom: 0.6 });
    controller.start(at(300, 300), true);
    controller.change(0.7, at(300, 300));
    controller.change(0.95, at(300, 300));
    expect(host.chip.mock.calls.map(([shown]) => shown)).toEqual([true, false]);
    controller.end(0.95, 0, at(300, 300));
    await vi.waitFor(() => expect(host.commit).toHaveBeenCalled());
    expect(host.commit.mock.calls[0]?.[0]).toEqual({ zoom: 0.6, fit: 'page' });
    expect(host.enterGrid).not.toHaveBeenCalled();
  });

  it('two fingers that lift without pinching leave the layer at rest', () => {
    const { host, controller } = fakeHost();
    controller.ready();
    expect(host.prepare).toHaveBeenCalledTimes(1);
    expect(controller.busy).toBe(true);
    controller.release();
    expect(controller.busy).toBe(false);
    expect(host.transform).toHaveBeenLastCalledWith(null);
  });

  it('notches step ×1.26 and retarget; one commit at the end', async () => {
    const { host, controller } = fakeHost({ ...BOUNDS, zoom: 2 });
    controller.notch(1, at(100, 100), 1000);
    controller.notch(1, at(100, 100), 1040);
    await vi.waitFor(() => expect(host.commit).toHaveBeenCalledTimes(1));
    expect(host.commit.mock.calls[0]?.[0].zoom).toBeCloseTo(2 * NOTCH_FACTOR ** 2, 9);
  });

  it('a notch out stops at fit page; after a 300 ms pause the next one opens the grid', () => {
    const { host, controller } = fakeHost({ ...BOUNDS, zoom: 0.6 });
    controller.notch(-1, at(100, 100), 1000);
    expect(host.enterGrid).toHaveBeenCalledTimes(1);
    host.enterGrid.mockClear();
    // Notches in quick succession at fit page do nothing…
    controller.notch(-1, at(100, 100), 1100);
    controller.notch(-1, at(100, 100), 1200);
    expect(host.enterGrid).not.toHaveBeenCalled();
    // …until the wheel pauses.
    controller.notch(-1, at(100, 100), 1550);
    expect(host.enterGrid).toHaveBeenCalledTimes(1);
  });

  it('a notch out from above fit page lands on it, not below', async () => {
    const { host, controller } = fakeHost({ ...BOUNDS, zoom: 0.7 });
    controller.notch(-1, at(100, 100), 5000);
    await vi.waitFor(() => expect(host.commit).toHaveBeenCalledTimes(1));
    expect(host.commit.mock.calls[0]?.[0]).toEqual({ zoom: 0.6, fit: 'page' });
    expect(host.enterGrid).not.toHaveBeenCalled();
  });

  it('a double tap zooms to 250 % about the tap', async () => {
    const { host, controller } = fakeHost();
    controller.smartZoom(at(200, 500));
    await vi.waitFor(() => expect(host.commit).toHaveBeenCalledTimes(1));
    const [rest, p, landing] = host.commit.mock.calls[0] ?? [];
    expect(rest).toEqual({ zoom: 2.5, fit: null });
    expect(p).toEqual(at(200, 500));
    expect(landing).toEqual(at(200, 500));
  });

  it('a pinch grabs a settle where it is', () => {
    const { host, transforms, controller } = fakeHost();
    controller.smartZoom(at(200, 500));
    // Mid-settle: some frames may not have run yet; whatever shows is grabbed.
    const before = transforms.at(-1) ?? { x: 0, y: 0, scale: 1 };
    controller.start(at(200, 500), true);
    controller.change(1, at(200, 500));
    const grabbed = transforms.at(-1);
    expect(grabbed?.scale).toBeCloseTo(before.scale, 6);
    expect(host.commit).not.toHaveBeenCalled();
    expect(host.prepare).toHaveBeenCalledTimes(1);
  });

  it('settles instantly under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';
    const { host, controller } = fakeHost();
    controller.start(at(10, 10), true);
    controller.change(2, at(10, 10));
    controller.end(2, 5, at(10, 10));
    expect(host.commit).toHaveBeenCalledTimes(1);
    expect(host.commit.mock.calls[0]?.[0]).toEqual({ zoom: 2.4, fit: null });
    expect(controller.busy).toBe(false);
  });

  it('stop() commits what shows; stop(false) just drops it', () => {
    const { host, controller } = fakeHost();
    controller.start(at(0, 0), true);
    controller.change(1.5, at(0, 0));
    controller.stop();
    expect(host.commit).toHaveBeenCalledTimes(1);
    const [rest, p, shown] = host.commit.mock.calls[0] ?? [];
    expect(rest?.zoom).toBeCloseTo(1.8, 9);
    expect(rest?.fit).toBeNull();
    expect(p).toEqual(at(0, 0));
    expect(shown).toEqual(at(0, 0));
    controller.start(at(0, 0), true);
    controller.change(1.5, at(0, 0));
    controller.stop(false);
    expect(host.commit).toHaveBeenCalledTimes(1);
    expect(host.transform).toHaveBeenLastCalledWith(null);
  });
});
