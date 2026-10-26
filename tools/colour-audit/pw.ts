import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root, two levels above this file. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const req = createRequire(`${ROOT}/apps/web/package.json`);
export const { chromium } = req('@playwright/test') as typeof import('@playwright/test');
const PREINSTALLED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
/** Chromium binary: PLAYWRIGHT_CHROMIUM, else the preinstalled one, else Playwright's own. */
export const EXE: string | undefined =
  process.env.PLAYWRIGHT_CHROMIUM ?? (existsSync(PREINSTALLED) ? PREINSTALLED : undefined);
/** Preview server to measure (apps/web `vite preview --port 4296`). */
export const BASE = process.env.COLOUR_AUDIT_BASE ?? 'http://localhost:4296/';
/** Where raw data, shots and reports are written (git-ignored by default). */
export const OUT = resolve(process.env.COLOUR_AUDIT_OUT ?? `${ROOT}/tools/colour-audit/out`);
export const VIEWPORTS = {
  desk: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
  },
  tablet: {
    viewport: { width: 1180, height: 820 },
    screen: { width: 1180, height: 820 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 8.1.0; SM-T837A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  phone: {
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
} as const;
