/**
 * The call gate (PF-24, perf audit R33 item 1): while a Read-mode page render waits for the
 * PDFium worker, the app's other calls to it wait too, so the first page is not queued behind
 * text reads, annotation lists, a scratch document's open/create/close or a save.
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
 *   page render waiting, an interactive call) is preceded by the calls held on its source. So a
 *   mutation and whatever depends on it never swap places; only reads, and writes on sources
 *   no waiting page shows (a scratch document), are postponed.
 * - Calls on different sources, and calls on bytes alone (`verify`), are independent.
 * - A call is held for at most `maxHoldMs`, so a stream of renders (a zoom, a scroll) cannot
 *   starve a read: an expired call is posted, in order, with the calls held before it on its
 *   source.
 * - A held call whose `AbortSignal` fires is posted at once; the proxy rejects it as aborted.
 * - A call is held only a macrotask when no page render waits: the gate decides after the tick
 *   in which a page's reads and its render are all issued, in whatever order.
 *
 * An unlisted method is not gated, and an unlisted one on the renderer is never wrapped, so a
 * test double without a method still reads as having none.
 */

/** How a call is scheduled (module comment). */
type CallKind = 'read' | 'write' | 'now';

/**
 * The proxy's calls by kind. `read`: answers from the document as it is, may wait. `write`: changes
 * a document (or hands out its bytes, which a pending edit must precede): waits only on a source
 * no waiting page shows. `now`: an interactive call the user is watching, posted at once. The
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
  private readonly maxHoldMs: number;
  private readonly now: () => number;
  private scheduled = false;
  private expiry: ReturnType<typeof setTimeout> | undefined;
  private channel: MessageChannel | undefined;

  constructor(options: CallGateOptions) {
    this.visibleSources = options.visibleSources;
    this.maxHoldMs = options.maxHoldMs ?? 750;
    this.now = options.now ?? (() => Date.now());
  }

  /** Calls held now (tests, diagnostics). */
  get heldCount(): number {
    return this.held.length;
  }

  /** `renderer` with its calls gated. Methods the gate does not know pass straight through. */
  wrap<T extends object>(renderer: T): T {
    const bound = new Map<string, unknown>();
    return new Proxy(renderer, {
      get: (target, property) => {
        const value: unknown = Reflect.get(target, property, target);
        if (typeof property !== 'string' || typeof value !== 'function') return value;
        let wrapped = bound.get(property);
        if (wrapped === undefined) {
          wrapped = this.gated(property, value.bind(target) as (...args: unknown[]) => unknown);
          bound.set(property, wrapped);
        }
        return wrapped;
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
          try {
            Promise.resolve(call(...args)).then(resolve, reject);
          } catch (error) {
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
    const waiting = this.visibleSources();
    const now = this.now();
    const keep: Held[] = [];
    for (const entry of this.held) {
      const release =
        waiting.size === 0 ||
        now - entry.issued >= this.maxHoldMs ||
        (entry.kind === 'write' && entry.source !== undefined && waiting.has(entry.source));
      if (!release) {
        keep.push(entry);
        continue;
      }
      // Calls kept before it on the same source go first, in the order they were made.
      if (entry.source !== undefined) {
        for (let at = 0; at < keep.length; at++) {
          const earlier = keep[at] as Held;
          if (earlier.source !== entry.source) continue;
          keep.splice(at--, 1);
          earlier.dispatch();
        }
      }
      entry.dispatch();
    }
    this.held = keep;
    if (keep.length > 0) {
      const oldest = Math.min(...keep.map((entry) => entry.issued));
      this.expiry = setTimeout(
        () => {
          this.expiry = undefined;
          this.drain();
        },
        Math.max(1, oldest + this.maxHoldMs - now),
      );
    }
  }
}
