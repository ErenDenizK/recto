import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { playwright } from '@vitest/browser-playwright';
import { searchForWorkspaceRoot } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';

import { chromiumLaunchOptions } from '../../tooling/playwright-chromium.ts';
import { ocrAssetsPlugin } from './ocr/assets.ts';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/**
 * The OCR tests also run in Firefox and WebKit (spec recognize-and-compare §8.5: "§1.5
 * thresholds on all three browsers"; M5-b). Opt-in by `ENGINE_OCR_BROWSERS=firefox,webkit`,
 * set by CI's `ocr-engines` job, because only Chromium is installed in most development
 * sandboxes. Each engine is a project of its own (`ocr-firefox`, `ocr-webkit`) with Playwright's
 * own browser and a longer time limit: without relaxed SIMD a page reads more slowly.
 */
const OCR_TESTS = ['src/ocr/**/*.test.ts', 'test/ocr-*.test.ts'];
const OCR_ENGINES = (process.env.ENGINE_OCR_BROWSERS ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter((name): name is 'firefox' | 'webkit' => name === 'firefox' || name === 'webkit');

/**
 * Tests that hold a wall-clock budget (the sample's render times, MOB-14). Run on their own,
 * after every other file: files run in parallel, and a neighbour that keeps every core busy
 * (OCR's pool of four recognizers) multiplies a render's time. Seen in CI: one page at 179 ms
 * whose best of three is 37 ms on a quiet runner.
 */
const TIMED_TESTS = ['src/pdfium/sample-render.test.ts'];

/**
 * Signature tests (M5 W3): `openssl cms -verify` of a detached CMS over the signed byte ranges,
 * chain checked against the test root. `available: false` when openssl is not installed.
 */
function opensslCmsVerify(
  _context: unknown,
  cmsBase64: string,
  contentBase64: string,
): { available: boolean; ok: boolean; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'engine-cms-'));
  try {
    writeFileSync(join(dir, 'sig.der'), Buffer.from(cmsBase64, 'base64'));
    writeFileSync(join(dir, 'data.bin'), Buffer.from(contentBase64, 'base64'));
    const args = [
      'cms',
      '-verify',
      '-binary',
      '-inform',
      'DER',
      '-in',
      join(dir, 'sig.der'),
      '-content',
      join(dir, 'data.bin'),
      '-CAfile',
      join(repoRoot, 'test/fixtures/pki/root-ca.cert.pem'),
      '-purpose',
      'any',
      '-out',
      join(dir, 'out.bin'),
    ];
    try {
      const out = execFileSync('openssl', args, { stdio: 'pipe', encoding: 'utf8' });
      return { available: true, ok: true, output: out };
    } catch (error) {
      const e = error as { code?: string; stderr?: string; message: string };
      if (e.code === 'ENOENT') return { available: false, ok: false, output: e.message };
      return { available: true, ok: false, output: e.stderr ?? e.message };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Engine tests run in a real browser (Vitest browser mode) so that PDFium's WASM, workers
// and OPFS behave exactly as in production. See docs/ARCHITECTURE.md §8.
export default defineConfig({
  // OCR (ADR-0012): serves `/ocr/**` (tesseract's worker and cores from node_modules, the
  // committed packs), each file checked against ocr/langs.lock.json as it is served.
  plugins: [ocrAssetsPlugin()],
  server: {
    fs: {
      // PDFium's `.wasm` is served straight from node_modules; with pnpm that lives at the
      // workspace root, outside this package.
      allow: [searchForWorkspaceRoot(fileURLToPath(new URL('.', import.meta.url)))],
      // Vite 8 denies *.{crt,pem,key,p12,pfx,cer,der} by default; the signature tests read the
      // test-only .p12 files in test/fixtures/pki, so only .p12 is re-allowed.
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem,key,pfx,cer,der}',
        '.npmrc',
        '.yarnrc.yml',
        '**/.git/**',
      ],
    },
  },
  // `@embedpdf/pdfium` locates its binary with `new URL('pdfium.wasm', import.meta.url)`.
  // Pre-bundling was verified not to break that under Vite 8, so it is left enabled. If it
  // ever does, add: optimizeDeps: { exclude: ['@embedpdf/pdfium', '@embedpdf/engines'] }.
  // Pre-bundle fontkit up front: discovering it mid-run (first overlay export) makes Vite
  // reload the browser and can fail tests that are already running.
  optimizeDeps: {
    include: [
      '@cantoo/fontkit',
      'pkijs',
      'asn1js',
      'diff',
      'pixelmatch',
      'linebreak',
      'tesseract.js',
      'pdfjs-dist/legacy/build/pdf.mjs',
    ],
  },
  test: {
    passWithNoTests: true,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({ launchOptions: chromiumLaunchOptions() }),
      commands: { opensslCmsVerify },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'engine',
          include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
          exclude: [...configDefaults.exclude, ...TIMED_TESTS],
          browser: {
            instances: [
              { browser: 'chromium', name: 'chromium' },
              ...OCR_ENGINES.map((browser) => ({
                browser,
                name: `ocr-${browser}`,
                include: OCR_TESTS,
                provider: playwright(),
                testTimeout: 120_000,
                hookTimeout: 120_000,
              })),
            ],
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'timed',
          include: TIMED_TESTS,
          // After every other file has finished, so nothing else runs meanwhile.
          sequence: { groupOrder: 1 },
          browser: { instances: [{ browser: 'chromium', name: 'chromium-timed' }] },
        },
      },
    ],
  },
});
