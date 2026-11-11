/**
 * The call gate (PF-24, perf audit R33 item 1): while renders wait for the PDFium worker, the
 * app's other calls to it wait too, so a page is not queued behind text reads, annotation
 * lists, a scratch document's open/create/close or a save, and the thumbnails are not queued
 * behind a flood of reads.
 *
 * The worker serves its calls in the order they arrive (one wasm thread, a lock per source),
 * and the render queue (`render-queue.ts`) only orders renders, so before this a page render
 * sat behind every call posted before it: 220 ms of the sample's 1.6 s first page. The gate
 * sits between the service and the proxy and decides when a call is posted, never how it is
 * answered; the worker is untouched (its script is at its bundle gate).
 *
 * What may be reordered, and what may not:
 *
 * - Renders (`renderPage`) are never held. Calls on the same source keep the order they were
 *   made in: before a render of a source is posted, every held call on it up to its last held
 *   write is posted first, and any call that is posted at once (a write on a source that has a
 *   render waiting, an interactive call) is preceded by the calls held on its source. So a
 *   mutation and whatever depends on it never swap places; only reads, and writes on sources
 *   no waiting render shows (a scratch document), are postponed.
 * - Calls on different sources, and calls on bytes alone (`verify`), are independent.
 * - While a page's render waits, reads are posted right behind it, not held and not capped. A
 *   first version held them (and a second capped them) for as long as a page render waited; in
 *   the phone's reader, whose scroll keeps page renders queued and asks for the text of every
 *   page it passes, the text of the page it stopped on never came (compact-capsule and
 *   compact-edit-text, phone and phone-land).
 * - While only other renders (thumbnails, tiles) wait, reads are trickled: at most `readTrickle`
 *   of them are in flight at once, newest first, so a flood (300 `listAnnotations` for a
 *   300-page document's page facts) cannot stand between the thumbnails and the worker, and
 *   still makes progress.
 * - A scratch document's write is held while any render waits, at most `maxHoldMs`, so a stream
 *   of renders cannot starve it: an expired one is posted, in order, with the calls held before
 *   it on its source.
 * - A held call whose `AbortSignal` fires is posted at once; the proxy rejects it as aborted.
 * - A call is held only a macrotask when nothing waits: the gate decides after the tick in
 *   which a page's reads and its render are all issued, in whatever order, so the render is
 *   posted first.
 *
 * An unlisted method is not gated, and an unlisted one on the renderer is never wrapped, so a
 * test double without a method still reads as having none.
 */

/** How a call is scheduled (module comment). */
type CallKind = 'read' | 'write' | 'now';

/**
 * The proxy's calls by kind. `read`: answers from the document as it is, may wait. `write`: changes
 * a document (or hands out its bytes, which a pending edit must precede): waits only on a source
 * no waiting render shows. `now`: an interactive call the user is watching, posted at once. The
 * pixel path of the page itself, `renderPage`, is handled apart.
 */
const KINDS: Readonly<Record<string, CallKind>> = {
  getPageText: 'read',
  search: 'read',
  listAnnotations: 'read',
  listFormFields: 'read',
  getAnnotationAppearance: 'read',
  locateRuns: 'read',
  analyzeRun: 'read',
  analyzeParagraphs: 'read',
  glyphPaths: 'read',
  checkEditability: 'read',
  analyzeParagraphLayout: 'read',
  locateImages: 'read',
  extractImage: 'read',
  ocrPageFacts: 'read',
  renderForOcr: 'read',
  verify: 'read',
  verifyRedactedOutput: 'read',
  computeSaveReceipt: 'read',
  open: 'write',
  close: 'write',
  save: 'write',
  createAnnotation: 'write',
  updateAnnotation: 'write',
  deleteAnnotation: 'write',
  appendInkPath: 'write',
  setFormFieldValue: 'write',
  applyRedactions: 'write',
  applyRedactionPlan: 'write',
  applyTextEdit: 'write',
  applyParagraphEdit: 'write',
  transformImage: 'write',
  removeImage: 'write',
  replaceImage: 'write',
  applyOcrLayer: 'write',
  renderParagraphPreview: 'now',
};

/** A held call: posting it is `dispatch`; `source` is the document it touches, when it has one. */
interface Held {
  readonly source: string | undefined;
  readonly kind: 'read' | 'write';
  readonly issued: number;
  dispatch: () => void;
  /** Removes the abort listener. */
  readonly forget: () => void;
}

export interface CallGateOptions {
  /** Sources that have a Read-mode page render queued or running right now. */
  readonly visibleSources: () => ReadonlySet<string>;
  /** Sources any render (a thumbnail's, a tile's, a page's) is queued or running for. */
  readonly renderSources?: () => ReadonlySet<string>;
  /** Reads in flight at once while only thumbnails wait. Default 2. */
  readonly readTrickle?: number;
  /**
   * Whether a source is one the user works with (a document the service opened): its calls are
   * never held for want of a render of its own. Only a scratch document's writes (the quirks
   * probe, a batch's private sources, which the engine opens without the service) are held.
   */
  readonly foreground?: (source: string) => boolean;
  /** The longest a call is held. Default 750 ms. */
  readonly maxHoldMs?: number;
  /** Clock for `maxHoldMs` (tests). */
  readonly now?: () => number;
}

/** The source a call touches, read off its arguments (an id, or a ref or run naming one). */
export function sourceOf(args: readonly unknown[]): string | undefined {
  const first = args[0];
  if (typeof first === 'string') return first;
  if (typeof first !== 'object' || first === null) return undefined;
  const named = first as { source?: unknown; run?: { source?: unknown } };
  if (typeof named.source === 'string') return named.source;
  if (typeof named.run?.source === 'string') return named.run.source;
  return undefined;
}

function signalOf(args: readonly unknown[]): AbortSignal | undefined {
  for (const arg of args) {
    const signal = (arg as { signal?: unknown } | null | undefined)?.signal;
    if (typeof AbortSignal !== 'undefined' && signal instanceof AbortSignal) return signal;
  }
  return undefined;
}

export class CallGate {
  private held: Held[] = [];
  private readonly visibleSources: () => ReadonlySet<string>;
  private readonly renderSources: () => ReadonlySet<string>;
  private readonly foreground: (source: string) => boolean;
  private readonly readTrickle: number;
  private readsInFlight = 0;
  private drainWaiters: (() => void)[] = [];
  private readonly maxHoldMs: number;
  private readonly now: () => number;
  private scheduled = false;
  private expiry: ReturnType<typeof setTimeout> | undefined;
  private channel: MessageChannel | undefined;

  constructor(options: CallGateOptions) {
    this.visibleSources = options.visibleSources;
    this.renderSources = options.renderSources ?? options.visibleSources;
    this.foreground = options.foreground ?? (() => false);
    this.readTrickle = options.readTrickle ?? 2;
    this.maxHoldMs = options.maxHoldMs ?? 750;
    this.now = options.now ?? (() => Date.now());
  }

  /** Calls held now (tests, diagnostics). */
  get heldCount(): number {
    return this.held.length;
  }

  /** `renderer` with its calls gated. Methods the gate does not know pass straight through. */
  wrap<T extends object>(renderer: T): T {
    // One wrapper per method, made again when the method itself is replaced (a spy in a test).
    const wrappers = new Map<string, { readonly method: unknown; readonly wrapped: unknown }>();
    return new Proxy(renderer, {
      get: (target, property) => {
        const value: unknown = Reflect.get(target, property, target);
        if (typeof property !== 'string' || typeof value !== 'function') return value;
        let cached = wrappers.get(property);
        if (cached?.method !== value) {
          cached = {
            method: value,
            wrapped: this.gated(property, value.bind(target) as (...args: unknown[]) => unknown),
          };
          wrappers.set(property, cached);
        }
        return cached.wrapped;
      },
    });
  }

  private gated(
    name: string,
    call: (...args: unknown[]) => unknown,
  ): (...args: unknown[]) => unknown {
    if (name === 'renderPage') {
      return (...args) => {
        this.flush(sourceOf(args), 'through-writes');
        return call(...args);
      };
    }
    if (name === 'destroy' || name === 'dispose') {
      return (...args) => {
        this.flush(undefined, 'all');
        return call(...args);
      };
    }
    const kind = KINDS[name];
    if (kind === undefined) return call;
    if (kind === 'now') {
      return (...args) => {
        this.flush(sourceOf(args), 'all');
        return call(...args);
      };
    }
    return (...args) => this.hold(kind, call, args);
  }

  /** Posts `call` when the gate allows: at the next drain (a macrotask on), or when released. */
  private hold(
    kind: 'read' | 'write',
    call: (...args: unknown[]) => unknown,
    args: unknown[],
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const signal = signalOf(args);
      const entry: Held = {
        source: sourceOf(args),
        kind,
        issued: this.now(),
        dispatch: () => {
          entry.forget();
          if (kind === 'read') this.readsInFlight += 1;
          const done = () => {
            if (kind !== 'read') return;
            this.readsInFlight -= 1;
            this.poke();
          };
          try {
            const result = Promise.resolve(call(...args));
            result.then(done, done);
            result.then(resolve, reject);
          } catch (error) {
            done();
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        },
        forget: () => signal?.removeEventListener('abort', onAbort),
      };
      const onAbort = () => {
        const at = this.held.indexOf(entry);
        if (at < 0) return;
        this.held.splice(at, 1);
        entry.dispatch();
      };
      if (signal?.aborted) {
        entry.dispatch();
        return;
      }
      signal?.addEventListener('abort', onAbort, { once: true });
      this.held.push(entry);
      this.schedule();
    });
  }

  /**
   * Resolves once the drain scheduled for the calls made so far has run (at once when none is
   * scheduled): the calls the gate lets through have been posted, the rest are held.
   */
  drained(): Promise<void> {
    if (!this.scheduled) return Promise.resolve();
    return new Promise((resolve) => {
      this.drainWaiters.push(resolve);
    });
  }

  /** A page render may have ended or been cancelled: post whatever no longer has to wait. */
  poke(): void {
    if (this.held.length > 0) this.drain();
  }

  /** Posts held calls on `source` (all when undefined) ahead of the call about to be posted. */
  private flush(source: string | undefined, how: 'through-writes' | 'all'): void {
    if (this.held.length === 0) return;
    let last = this.held.length - 1;
    if (how === 'through-writes') {
      last = -1;
      this.held.forEach((entry, at) => {
        if (entry.kind === 'write' && entry.source === source && source !== undefined) last = at;
      });
    }
    const send: Held[] = [];
    const keep: Held[] = [];
    this.held.forEach((entry, at) => {
      const mine = source === undefined || entry.source === source;
      (at <= last && mine ? send : keep).push(entry);
    });
    this.held = keep;
    for (const entry of send) entry.dispatch();
  }

  /** Decides, one macrotask after the tick that made the calls (a message, so never throttled). */
  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    const run = () => {
      this.scheduled = false;
      this.drain();
      const waiters = this.drainWaiters;
      this.drainWaiters = [];
      for (const resolve of waiters) resolve();
    };
    if (typeof MessageChannel === 'undefined') {
      setTimeout(run, 0);
      return;
    }
    this.channel ??= new MessageChannel();
    this.channel.port1.onmessage = run;
    this.channel.port2.postMessage(0);
  }

  private drain(): void {
    if (this.expiry !== undefined) clearTimeout(this.expiry);
    this.expiry = undefined;
    if (this.held.length === 0) return;
    const pageBusy = this.visibleSources().size > 0;
    const waiting = this.renderSources();
    const busy = pageBusy || waiting.size > 0;
    const now = this.now();
    // Which calls go now.
    const go = new Set<Held>();
    // The cap is for floods behind thumbnails and tiles. While a page renders, reads are posted
    // right behind its render and not capped: a scroll asks for the text of every page it passes,
    // and capping those (newest first or oldest first) starves the page the reader stops on.
    let slots =
      busy && !pageBusy ? this.readTrickle - this.readsInFlight : Number.POSITIVE_INFINITY;
    // Reads newest first: behind thumbnails, the ones asked last are the ones on screen, and the
    // flood of older ones (page facts of the whole document) can wait.
    for (let at = this.held.length - 1; at >= 0; at--) {
      const entry = this.held[at] as Held;
      if (entry.kind === 'read') {
        if (slots > 0) {
          go.add(entry);
          slots -= 1;
        }
      } else if (
        !busy ||
        now - entry.issued >= this.maxHoldMs ||
        // A scratch document's write waits for the renders. The user's own calls never do:
        // a source of the service, or one a render shows.
        (entry.source !== undefined && (waiting.has(entry.source) || this.foreground(entry.source)))
      ) {
        go.add(entry);
      }
    }
    // Post them in the order they were made, each after the calls held on its source that must
    // precede it: for a write all the earlier ones, for a read those up to the last write.
    const keep: Held[] = [];
    for (const entry of this.held) {
      if (!go.has(entry)) {
        keep.push(entry);
        continue;
      }
      if (entry.source !== undefined) {
        let last = keep.length - 1;
        if (entry.kind === 'read') {
          last = -1;
          keep.forEach((earlier, at) => {
            if (earlier.kind === 'write' && earlier.source === entry.source) last = at;
          });
        }
        for (let at = 0; at <= last; at++) {
          const earlier = keep[at] as Held;
          if (earlier.source !== entry.source) continue;
          keep.splice(at--, 1);
          last -= 1;
          earlier.dispatch();
        }
      }
      entry.dispatch();
    }
    this.held = keep;
    // Wake for the first held write that is yet to expire. Reads wait for a slot instead: they
    // go when a read in flight settles (`poke`), not by polling.
    let next = Number.POSITIVE_INFINITY;
    for (const entry of keep) {
      if (entry.kind !== 'write') continue;
      const left = entry.issued + this.maxHoldMs - now;
      if (left > 0) next = Math.min(next, left);
    }
    if (busy && next < Number.POSITIVE_INFINITY) {
      this.expiry = setTimeout(() => {
        this.expiry = undefined;
        this.drain();
      }, next);
    }
  }
}
