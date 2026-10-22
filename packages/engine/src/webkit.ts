/**
 * WebKit (Safari, every iOS browser) told apart by its user agent: Chromium's names AppleWebKit
 * too, and only it says Chrome or Chromium. OCR sizes its pool by it (`ocr/recognizer.ts`); the
 * PDFium proxy has page renders sent as pixels on it (PF-22, `worker/pdfium-protocol.ts`).
 */
export function isWebKitUserAgent(userAgent: string): boolean {
  return userAgent.includes('AppleWebKit') && !/Chrome\/|Chromium\//.test(userAgent);
}

/** Whether this thread runs in WebKit (false where there is no `navigator`). */
export function isWebKit(): boolean {
  const nav = (globalThis as { navigator?: Partial<Navigator> }).navigator;
  return isWebKitUserAgent(nav?.userAgent ?? '');
}
