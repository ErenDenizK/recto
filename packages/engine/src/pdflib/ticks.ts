/**
 * How often pdf-lib yields to the event loop (docs/plan/v1/PLAN.md PF-3; perf-audit.md item 3).
 *
 * pdf-lib's `load()` yields every `parseSpeed` objects (default 100) and `save()` every
 * `objectsPerTick` (default 50), each time through `setTimeout(0)`. Browsers clamp nested
 * timers to at least 4 ms, workers included, so on a document of 16,000 objects the default
 * spends about 3 s waiting on timers. All of our pdf-lib passes run in workers, where there is
 * no UI to keep responsive, so they yield far less often.
 *
 * The value stays finite (never `Infinity`): a pass still yields every few tens of
 * milliseconds, so an abort posted from the main thread is received promptly and the
 * `throwIfAborted` checks between passes see it. The tick count never changes what is written:
 * the bytes are identical (pdflib/ticks.test.ts).
 */

/** Objects parsed or written between two yields: a few tens of ms of work in a worker. */
export const PDFLIB_OBJECTS_PER_TICK = 2_000;

/** Spread into every `PDFDocument.load` options object. */
export const PDFLIB_LOAD_TICKS = { parseSpeed: PDFLIB_OBJECTS_PER_TICK } as const;

/** Spread into every `PDFDocument.save` options object. */
export const PDFLIB_SAVE_TICKS = { objectsPerTick: PDFLIB_OBJECTS_PER_TICK } as const;
