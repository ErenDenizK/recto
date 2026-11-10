/**
 * The render queue of `EngineService` (docs: engine-service.ts header): a priority queue of
 * render jobs, two in flight by default. Requests for the same bitmap share one job; a job is
 * cancelled (AbortSignal) once every requester has lost interest. Higher priority runs first,
 * the oldest first among equals. Split from the service so the scheduling is one unit; the
 * service re-exports `RENDER_PRIORITY` and `RenderRequest`.
 */
import type { Rect, Rotation, SourceId } from '@pdf-editor/document-model';

import type { CachedBitmap } from './bitmap-cache';
import { type EngineResult, fail } from './engine-result';

/** Higher runs first. */
export const RENDER_PRIORITY = { page: 3, visible: 2, offscreen: 1 } as const;

export interface RenderRequest {
  readonly sourceId: SourceId;
  readonly index: number;
  /** Rotation on top of the page's intrinsic /Rotate (VirtualPage.rotation). */
  readonly rotation: Rotation;
  /** Device pixels per point: from `chooseScale` (Read mode) or `chooseBucket` (thumbnails). */
  readonly bucket: number;
  readonly priority: number;
  readonly signal?: AbortSignal;
  /**
   * Render only this rectangle (unrotated user space) — a tile of a page too large to
   * render in one piece. `tile` names it in the cache (e.g. `t1024:2,3`); both or neither.
   */
  readonly clip?: Rect;
  readonly tile?: string;
  /**
   * Without annotations and form widgets: the page as its content alone, for "see the
   * original" (docs/plan/v1/PLAN.md S2-1a, the title menu's eye). Cached apart from the
   * page's own bitmaps, as a tile is (`#bare`), so neither ever stands in for the other.
   */
  readonly bare?: boolean;
}

/** The cache's name for a request's tile, with the bare form marked (`RenderRequest.bare`). */
export function tileOf(request: Pick<RenderRequest, 'tile' | 'bare'>): string | undefined {
  if (request.bare !== true) return request.tile;
  return request.tile === undefined ? 'bare' : `${request.tile}+bare`;
}

export interface Subscriber {
  readonly priority: number;
  readonly resolve: (result: EngineResult<CachedBitmap>) => void;
}

export interface Job {
  readonly key: string;
  readonly page: string;
  readonly request: RenderRequest;
  readonly controller: AbortController;
  readonly subscribers: Set<Subscriber>;
  readonly seq: number;
  running: boolean;
  /** Set by `close`: the source went away, so a late result must not be cached. */
  sourceClosed: boolean;
  /** Set by `invalidatePage`: the page changed while this job ran; its result is stale. */
  stale: boolean;
}

/**
 * Cache identity of a tile: its own "page" (`…:rotation#tile`) so tiles never stand in for
 * a whole-page preview (`BitmapCache.best`), yet `removeSource` still drops them.
 */
export function tileAwarePage(page: string, tile: string | undefined): string {
  return tile === undefined ? page : `${page}#${tile}`;
}

export function tileAwareKey(page: string, tile: string | undefined, bucket: number): string {
  return `${tileAwarePage(page, tile)}:${bucket}`;
}

/** The jobs of one engine service and the pump that starts them, `concurrency` at a time. */
export class RenderQueue {
  /** Jobs queued or running, by cache key. */
  readonly jobs = new Map<string, Job>();
  /** Jobs running now. */
  running = 0;
  private seq = 0;

  constructor(
    private readonly concurrency: number,
    /** Runs one job to its end (it resolves the job's subscribers itself). */
    private readonly runJob: (job: Job) => Promise<void>,
    /** Called after a job ended or was cancelled (the call gate re-reads `visibleSources`). */
    private readonly onSettle?: () => void,
  ) {}

  /**
   * The sources a Read-mode page render (`RENDER_PRIORITY.page`) is queued or running for: the
   * renders the call gate lets nothing overtake (engine-gate.ts).
   */
  visibleSources(): ReadonlySet<string> {
    const sources = new Set<string>();
    for (const job of this.jobs.values()) {
      if (this.priorityOf(job) >= RENDER_PRIORITY.page) sources.add(job.request.sourceId);
    }
    return sources;
  }

  /** The job for `key`, a new queued one when there is none. */
  job(key: string, page: string, request: RenderRequest): Job {
    let job = this.jobs.get(key);
    if (job === undefined) {
      job = {
        key,
        page,
        request,
        controller: new AbortController(),
        subscribers: new Set(),
        seq: this.seq++,
        running: false,
        sourceClosed: false,
        stale: false,
      };
      this.jobs.set(key, job);
    }
    return job;
  }

  private priorityOf(job: Job): number {
    let max = -Infinity;
    for (const s of job.subscribers) max = Math.max(max, s.priority);
    return max;
  }

  cancel(job: Job, reason: string): void {
    if (this.jobs.get(job.key) === job) this.jobs.delete(job.key);
    job.controller.abort(new DOMException(reason, 'AbortError'));
    for (const s of job.subscribers) s.resolve(fail('aborted', reason));
    job.subscribers.clear();
    this.onSettle?.();
  }

  private next(): Job | undefined {
    let best: Job | undefined;
    let bestPriority = -Infinity;
    for (const job of this.jobs.values()) {
      if (job.running) continue;
      const priority = this.priorityOf(job);
      if (priority > bestPriority || (priority === bestPriority && best && job.seq < best.seq)) {
        best = job;
        bestPriority = priority;
      }
    }
    return best;
  }

  /** Starts queued jobs while a slot is free. */
  pump(): void {
    while (this.running < this.concurrency) {
      const job = this.next();
      if (job === undefined) return;
      job.running = true;
      this.running += 1;
      void this.runJob(job).finally(() => {
        this.running -= 1;
        this.onSettle?.();
        this.pump();
      });
    }
  }
}
