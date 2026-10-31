/**
 * The Text view's contract (PRD-36, EDN-26): the types its data layer (`loader.ts`,
 * `position.ts`, `find-map.ts`, `reading-prefs.ts`, `image-crops.ts`, `ocr-offer.ts`) implements
 * and its view (`TextView.tsx`) and the phone door (`shell/compact/textview-host.tsx`) consume.
 * Types only, no runtime: the view is built against a fake loader, the door against the view's
 * props, and neither imports the other's side. Nothing here imports from `shell/compact`.
 *
 * Pages are 0-based document page indices throughout. Boxes are in the page's display space
 * (points, top-left origin, y down, after rotation), as the engine's `TextViewPage` has them
 * (PRD-35); only `hit` rects in `find-map.ts` and the crops' clip are in user space.
 */
import type { Rect } from '@pdf-editor/document-model';
import type { TextViewPage } from '@pdf-editor/engine';

import type { PageFrame } from '../viewer/geometry';

/** What the loader holds for a page: its blocks, `'loading'` (asked, not back) or `'failed'`. */
export type TextViewPageState = TextViewPage | 'loading' | 'failed';

/**
 * The document's text, page by page, for the view (EDN-26). Pages are read in aligned chunks
 * of 4 (never fewer than 2), always with the whole document's style; at most 120 pages are
 * kept. `peek` and `subscribe` are a `useSyncExternalStore` pair: `peek` returns the same value
 * until the page changes and notifies once per change.
 */
export interface TextViewLoader {
  /** Pages in the document; it can change after `subscribe` fires (an edit, OCR). */
  readonly pageCount: number;
  /** The document's /Lang (BCP 47), when it names one. */
  readonly language: string | undefined;
  /** The page's frame at 1 point per unit, to map user space to display space. */
  frame(page: number): PageFrame;
  /**
   * Asks for the chunk holding `page`; resolves when it is back or has failed, never rejects.
   * A page already loaded, or being loaded, costs nothing.
   */
  ensure(page: number): Promise<void>;
  peek(page: number): TextViewPageState;
  subscribe(listener: () => void): () => void;
  /** Asks again for a failed page's chunk. */
  retry(page: number): Promise<void>;
  /** Forgets these pages (after OCR wrote text on them); they load again when asked. */
  invalidate(pages: readonly number[]): void;
  /** Aborts what is in flight and releases the analysis lease; the loader is then dead. */
  dispose(): void;
}

/** A place in the document: a page and the offset in its display space. */
export interface TextViewPlace {
  readonly page: number;
  /** Points from the top of the displayed page. */
  readonly y: number;
}

export type ReadingSpacing = 'tight' | 'normal' | 'loose';
export type ReadingTheme = 'auto' | 'light' | 'dark';
/** `serif` is the system serif; the choice is shown only if the owner takes it (DSN-84). */
export type ReadingFace = 'sans' | 'serif';

/** How the text is set (DSN-84). Kept on the device in `pdf-editor:textview:v1`. */
export interface ReadingPrefs {
  /** Index into the 7 sizes 15, 16, 18, 20, 22, 25, 28 px (default 2: 18). */
  readonly size: number;
  readonly spacing: ReadingSpacing;
  readonly theme: ReadingTheme;
  readonly face: ReadingFace;
}

/**
 * Where Find's current hit sits in the text (PRD-36): `start` and `length` index the text of the
 * block, or of its list item `item`. `exact` is false when the hit's words were not found in the
 * block (a joined hyphen, a ligature): the whole block is then marked, lightly.
 */
export interface FindMark {
  readonly blockId: string;
  /** Index into a list block's items. */
  readonly item?: number;
  readonly start: number;
  readonly length: number;
  readonly exact: boolean;
}

/** Crops of a page for image blocks. */
export interface ImageCrops {
  /**
   * The part of `page` inside `bbox` (display space) as a PNG, `widthPx` device pixels wide,
   * scaled down to stay under the 4 MP cap (PF-19). Rejects with an `aborted` error when `signal`
   * fires.
   */
  render(page: number, bbox: Rect, widthPx: number, signal: AbortSignal): Promise<Blob>;
}

/** What the scanned-page card says before a run (EDN-27). */
export interface OcrOfferInfo {
  /** Tesseract codes of the run, such as `['tur', 'eng']`. */
  readonly languages: readonly string[];
  /** The languages in the UI language: "Turkish and English". */
  readonly languageLabel: string;
  /** What the packs cost to download; 0 when they are on the device. */
  readonly downloadBytes: number;
}

export interface OcrOffer {
  info(): Promise<OcrOfferInfo>;
  /**
   * Recognizes `pages` and writes the text as one undo step. Resolves true when it was written,
   * false when cancelled; rejects when recognition failed. Lazy: the OCR code loads on this call.
   */
  run(
    pages: readonly number[],
    control: {
      readonly signal: AbortSignal;
      readonly onProgress: (done: number, total: number) => void;
    },
  ): Promise<boolean>;
}

/**
 * What the door hands the view (`shell/compact/textview-host.tsx`). The view takes its chrome
 * through these props and imports nothing from the shell.
 */
export interface TextViewHostProps {
  readonly title: string;
  readonly loader: TextViewLoader;
  readonly crops: ImageCrops;
  readonly ocr: OcrOffer;
  /** Where to open: the reader's top place. */
  readonly place: TextViewPlace;
  /** A place to scroll to (Go to page, Contents, Find); `id` makes a repeat a new request. */
  readonly jump: { readonly id: number; readonly place: TextViewPlace } | null;
  /** Find's current hit in the text, or null. */
  readonly mark: FindMark | null;
  /** The view's bar steps away (Find has the bottom); the door sets it while Find is docked. */
  readonly barAway?: boolean;
  /** Mounted but not shown (the reader is): inert, and it loads nothing. */
  readonly hidden: boolean;
  /** The place at the top of the column changed (the door sets the current page from it). */
  onPlace(place: TextViewPlace): void;
  /** Leave for the page view at `place`. */
  onPageView(place: TextViewPlace): void;
  /** The `n / N` button: open the Go to page sheet. */
  onGoto(): void;
  /** The Find button. */
  onFind(): void;
  /** "Show page": the page view at `place`. */
  onShowPage(place: TextViewPlace): void;
}
