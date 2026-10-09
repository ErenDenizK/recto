/**
 * Entry `@pdf-editor/engine/client` (docs/plan/v1/PLAN.md PF-2; perf-audit.md item 2): what the
 * app's main thread needs from the engine, without the engine. The barrel
 * (`@pdf-editor/engine`) imports pdf-lib, fontkit, pkijs, EmbedPDF and the PDFium glue, about
 * 750 KB gzip; the main thread only talks to the workers that run them. This entry holds:
 *
 * - the worker proxies (`createPdfiumProxy`, `createAssemblerProxy`, `createCompressProxy`,
 *   `createSignatureProxy`), so the PDFium worker is configured, and its wasm fetched, as soon
 *   as this small chunk arrives;
 * - the protocol types and `EngineError`, the edit payload helpers, and the pure helpers the UI
 *   calls (compression presets and estimates, raster plans and page ranges, OCR thresholds,
 *   payloads and pool size, the OCR recognizer, which loads tesseract.js itself on first use);
 * - `postableModule`, for handing the PDFium worker's compiled wasm to other workers (PF-4).
 *
 * Nothing here may import pdf-lib, fontkit, pkijs or EmbedPDF: `tools/qa/bundle-budget.ts` gates
 * this entry's closure (`engineClient`). Heavy main-thread uses stay on the barrel, behind
 * `await import()`: text and image editing, redaction matching, Compare and convert.
 */
export * from './types';
export * from './edits';
export {
  createPdfiumProxy,
  type PdfiumProxy,
  type PdfiumProxyOptions,
} from './worker/pdfium-proxy';
export type { PdfiumWorkerConfig } from './worker/pdfium-protocol';
export { type AssemblerProxy, createAssemblerProxy } from './worker/create-assembler-proxy';
export { type CompressProxy, createCompressProxy } from './worker/create-compress-proxy';
export type {
  CompressRunWireOptions,
  CompressWorkerConfig,
  RasterFile,
} from './worker/compress-protocol';
export {
  createSignatureProxy,
  type SignatureProxy,
  type SignatureProxyConfig,
} from './worker/signature-proxy';
export { postableModule } from './pdfium/wasm-module';
export { type RedactionFailure, RedactionFailedError } from './redaction/failure';
export { type TextEditFailure, textEditError, textEditFailureReason } from './text-edit/errors';
export {
  type ImageEditFailure,
  imageEditError,
  imageEditFailureReason,
} from './image-objects/errors';
export type * from './compress/types';
export {
  COMPRESSION_PRESETS,
  type CompressionEstimate,
  DOWNSAMPLE_THRESHOLD,
  estimateCompression,
  jpegBytesPerPixel,
  MAX_DPI,
  MIN_DPI,
  planImage,
  presetSettings,
  targetSize,
  WORTHWHILE_RATIO,
} from './compress/presets';
export * from './rasterize/plan';
export {
  applyOcrEdit,
  ocrApplyEdit,
  ocrApplyPayloadOf,
  ocrLayerPlanOf,
  readOcrApplyPayload,
} from './ocr/edit';
export { meanConfidence, ocrDpiFor, ocrQuality, ocrReportOf } from './ocr/quality';
export { type OcrLanguagePack, OcrPackStore } from './ocr/packs';
export {
  createOcrRecognizer,
  OCR_IDLE_MS,
  OCR_MAX_POOL_SIZE,
  OCR_PAGE_TIMEOUT_MS,
  ocrCoreVariant,
  ocrEngineFiles,
  ocrPoolEnvironment,
  ocrPoolSize,
} from './ocr/recognizer';
