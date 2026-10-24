import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { paraglideVitePlugin } from '@inlang/paraglide-js';
import babel from '@rolldown/plugin-babel';
import { ocrAssetsPlugin } from '@pdf-editor/engine/ocr/assets';
import { officeAssetsPlugin } from '@pdf-editor/engine/office/assets';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves project sites under `/<repo>/`; CI sets VITE_BASE_PATH accordingly
// (ADR-0004). Every path-dependent setting must derive from `base`.
const base = process.env.VITE_BASE_PATH ?? '/';

/** Precache ceiling. Wasm is never precached; this only bounds JS chunks (the engine
 *  chunk is ~1.3 MB) so an accidental multi-megabyte asset fails the build (ADR-0010). */
const MAX_PRECACHE_BYTES = 4 * 1024 * 1024;
/** Fonts above this size are runtime-cached instead of precached (ADR-0010). */
const MAX_PRECACHED_FONT_BYTES = 1024 * 1024;
const DAY_SECONDS = 24 * 60 * 60;

/**
 * `@embedpdf/engines` declares no `sideEffects`, so importing `PdfiumNative` and `PdfEngine`
 * from its root (the PDFium host, ADR-0011) would keep everything the root re-exports:
 * EmbedPDF's own blob-worker engine (~700 KB, a second copy of the PDFium glue) and its CDN
 * font tables, which the app never uses. Its modules only declare classes and functions, so
 * unused ones can be dropped. Other modules keep their default side-effect handling.
 */
const EMBEDPDF_ENGINES_PURE = [{ test: /[\\/]@embedpdf[\\/]engines[\\/]/, sideEffects: false }];

/**
 * Where each emitted chunk's bytes come from, for the bundle budget's breakdown
 * (tools/qa/bundle-budget.ts): every chunk's modules with their rendered length (after tree
 * shaking, before minification). Written beside Vite's cache, outside `dist/`, so it is never
 * deployed or precached; the budget matches it to the build by file name.
 */
function bundleModules(): Plugin {
  /** Module ids are written relative to the repository. */
  const root = fileURLToPath(new URL('../..', import.meta.url));
  return {
    name: 'recto:bundle-modules',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks: Record<string, Record<string, number>> = {};
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        const modules: Record<string, number> = {};
        for (const [id, info] of Object.entries(output.modules)) {
          if (info.renderedLength > 0) modules[id.replace(root, '')] = info.renderedLength;
        }
        chunks[output.fileName] = modules;
      }
      const dir = fileURLToPath(new URL('./node_modules/.cache/recto', import.meta.url));
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/bundle-modules.json`, JSON.stringify(chunks));
    },
  };
}

/**
 * The two edition modules (ADR-0033 §2.1), each loaded by `main.tsx` with a dynamic import. A
 * launch whose edition chunk fails imports it again under a fresh URL (`src/pwa/boot-reload.ts`,
 * PRD-26); that is safe only while the chunk is a thin facade no other chunk imports, so a
 * retried copy never duplicates a store or a React context.
 */
const EDITIONS = {
  full: { id: fileURLToPath(new URL('./src/app.tsx', import.meta.url)), name: 'App' },
  compact: {
    id: fileURLToPath(new URL('./src/shell/compact/CompactApp.tsx', import.meta.url)),
    name: 'CompactApp',
  },
} as const;

/** What `src/pwa/boot-reload.ts` reads: the editions' chunk files, full then compact. */
const EDITION_CHUNKS_PLACEHOLDER = '__RECTO_EDITION_CHUNKS__';

interface GraphInfo {
  readonly importedIds: readonly string[];
  readonly dynamicallyImportedIds: readonly string[];
  readonly code: string | null;
}

/** Paraglide's message barrels: what imports them uses a few messages, never all of them. */
const MESSAGE_BARREL = /[\\/]i18n[\\/]paraglide[\\/]messages(?:\.js|[\\/]_index\.js)$/;
const MESSAGE_MODULE = /[\\/]i18n[\\/]paraglide[\\/]messages[\\/](\w+)\.js$/;

/**
 * The `codeSplitting` group name for a module (`build.rolldownOptions`, PRD-26), so each
 * edition's chunk is a facade of its module alone and no other chunk imports it:
 *
 * - `editor` or `compact-core`: what that edition reaches by static imports and dominates (no
 *   path from `main.tsx` reaches it without passing the edition's module);
 * - `editions`: what both editions reach by static imports and the entry does not, which loads
 *   with either edition anyway (else the default merges it into a facade);
 * - the default for the rest: the entry's statics (first paint), each lazy chunk's own modules,
 *   and every module some chunk imports dynamically, which stays the root of its own chunk.
 *
 * Paraglide's barrels are read as the messages each module calls (`m.<id>`, however it
 * imported `m`), not as every message: that is what tree shaking makes of them.
 */
function editionGroups(): (
  id: string,
  ctx: { getModuleInfo(id: string): GraphInfo | null },
) => string | null {
  const main = fileURLToPath(new URL('./src/main.tsx', import.meta.url));
  let owner: Map<string, string> | undefined;

  const plan = (get: (id: string) => GraphInfo | null): Map<string, string> => {
    // The graph from the entry, each barrel edge replaced by the messages the importer calls.
    const messages = new Map<string, string>();
    const statics = new Map<string, string[]>();
    const dynamics = new Map<string, readonly string[]>();
    const callers: string[] = [];
    const queue = [main];
    while (queue.length > 0) {
      const id = queue.pop() as string;
      if (statics.has(id)) continue;
      const info = get(id);
      const imported = info?.importedIds ?? [];
      const message = MESSAGE_MODULE.exec(id)?.[1];
      if (message !== undefined) messages.set(message, id);
      statics.set(
        id,
        imported.filter((next) => !MESSAGE_BARREL.test(next)),
      );
      dynamics.set(id, info?.dynamicallyImportedIds ?? []);
      // `m` comes through `../i18n` as often as from the barrel itself: any module calling it.
      if (/\bm\.\w/.test(info?.code ?? '')) callers.push(id);
      queue.push(...imported, ...(info?.dynamicallyImportedIds ?? []));
    }
    for (const id of callers) {
      const list = statics.get(id) as string[];
      // Calls, not the comments that show one (`m.open_files()` in i18n/index.ts's).
      const code = (get(id)?.code ?? '').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      for (const match of code.matchAll(/\bm\.(\w+)/g)) {
        const target = messages.get(match[1] as string);
        if (target !== undefined) list.push(target);
      }
    }
    const reach = (root: string, skip: string | null, dynamic: boolean): Set<string> => {
      const seen = new Set<string>();
      const stack = [root];
      while (stack.length > 0) {
        const id = stack.pop() as string;
        if (id === skip || seen.has(id)) continue;
        seen.add(id);
        stack.push(...(statics.get(id) ?? []));
        if (dynamic) stack.push(...(dynamics.get(id) ?? []));
      }
      return seen;
    };

    const result = new Map<string, string>();
    const everything = reach(main, null, true);
    const first = reach(main, null, false);
    const targets = new Set([...dynamics.values()].flat());
    const own = {
      full: reach(EDITIONS.full.id, null, false),
      compact: reach(EDITIONS.compact.id, null, false),
    };
    for (const [edition, group] of [
      ['full', 'editor'],
      ['compact', 'compact-core'],
    ] as const) {
      const { id: module } = EDITIONS[edition];
      const without = reach(main, module, true);
      for (const id of own[edition]) {
        if (id !== module && everything.has(id) && !without.has(id)) result.set(id, group);
      }
    }
    for (const id of own.compact) {
      if (own.full.has(id) && !first.has(id) && !targets.has(id) && !result.has(id)) {
        result.set(id, 'editions');
      }
    }
    return result;
  };

  return (id, ctx) => {
    owner ??= plan((m) => ctx.getModuleInfo(m));
    return owner.get(id) ?? null;
  };
}

/**
 * Writes the editions' chunk files over `EDITION_CHUNKS_PLACEHOLDER` (read by
 * `src/pwa/boot-reload.ts`), and fails the build when an edition's chunk is missing, does not
 * export the edition's component (`main.tsx` reads that key), or is imported by another chunk.
 */
function editionChunks(): Plugin {
  return {
    name: 'recto:edition-chunks',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((output) => output.type === 'chunk');
      if (!chunks.some((chunk) => chunk.code.includes(EDITION_CHUNKS_PLACEHOLDER))) return;
      const files: string[] = [];
      for (const { id, name } of [EDITIONS.full, EDITIONS.compact]) {
        const chunk = chunks.find((c) => c.facadeModuleId === id);
        if (!chunk) throw new Error(`recto:edition-chunks: no chunk for ${name} (${id})`);
        if (!chunk.exports.includes(name)) {
          throw new Error(`recto:edition-chunks: ${chunk.fileName} does not export ${name}`);
        }
        const importers = chunks.filter((c) => c.imports.includes(chunk.fileName));
        if (importers.length > 0) {
          throw new Error(
            `recto:edition-chunks: ${chunk.fileName} is imported by ${importers.map((c) => c.fileName).join(', ')}; it holds ${Object.keys(chunk.modules).join(', ')}`,
          );
        }
        files.push(chunk.fileName);
      }
      const value = JSON.stringify(JSON.stringify(files));
      for (const chunk of chunks) {
        chunk.code = chunk.code.replace(/(["'`])__RECTO_EDITION_CHUNKS__\1/g, value);
      }
    },
  };
}

/**
 * Build identity for the About dialog (ADR-0017 §6), injected as `define` constants and
 * read through `src/shell/about/build-info.ts`. The version is the web package's, which the
 * release workflow tags.
 */
const appVersion = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

/** The about page's footer reads the version as `%VITE_APP_VERSION%`; CI may set it. */
process.env.VITE_APP_VERSION ??= appVersion;

/**
 * The about page links to the sources of the build it ships with (`%VITE_SOURCE_REF%` in
 * `about/index.html`): the full commit SHA, so the links hold whatever the branches do. CI's
 * `GITHUB_SHA`, else the checkout's HEAD, else the development branch.
 */
process.env.VITE_SOURCE_REF ??= sourceRef();

/** Full SHA of the built commit, else `develop` (no commit is known outside a checkout). */
function sourceRef(): string {
  const fromCi = process.env.GITHUB_SHA?.trim();
  if (fromCi) return fromCi;
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return sha === '' ? 'develop' : sha;
  } catch {
    return 'develop';
  }
}

/** Short SHA of the built commit: CI's `GITHUB_SHA`, else the checkout's HEAD, else "unknown". */
function appCommit(): string {
  const fromCi = process.env.GITHUB_SHA?.trim();
  if (fromCi) return fromCi.slice(0, 7);
  try {
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return sha === '' ? 'unknown' : sha;
  } catch {
    // Not a git checkout (e.g. a source tarball) or git is not installed.
    return 'unknown';
  }
}

/** ISO 8601 build time. `SOURCE_DATE_EPOCH` (seconds) pins it for reproducible builds. */
function buildDate(): string {
  const epoch = Number(process.env.SOURCE_DATE_EPOCH);
  const date =
    process.env.SOURCE_DATE_EPOCH && Number.isFinite(epoch) ? new Date(epoch * 1000) : new Date();
  return date.toISOString();
}

/**
 * The build target (docs/plan/v1/editions.md §4.1, PLAN ED-1): `#platform` resolves to
 * `src/platform/<target>/`, so a build carries one target's adapter and nothing of another's.
 * Only `web` exists until DT-0 adds `desktop`.
 */
const target = process.env.RECTO_TARGET ?? 'web';
if (target !== 'web') {
  throw new Error(`RECTO_TARGET=${target}: only the web target exists (DT-0 adds desktop).`);
}

/**
 * Lab flags (editions.md §4.4, PLAN ED-3): unfinished work sits behind `if (__LAB__)` with a
 * dynamic import, so a build without `RECTO_LAB=1` (every deploy and release build, Vitest and
 * Playwright's) compiles none of it. tools/qa/bundle-budget.ts fails a build that carries some.
 */
const lab = process.env.RECTO_LAB === '1';

/** Escapes a string for use inside a RegExp. */
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * One fontkit for the app and its workers (R27 P2, docs/research/perf/phone-first-load-2026-10.md).
 * Each `?worker` is its own build, so the assembler and analysis workers each bundled a private
 * copy of `@cantoo/fontkit` (~150 KiB gzip), beside the main thread's. The main build emits it
 * once as the entry `assets/fontkit.js` (unhashed, so a worker build can name it; the precache
 * revisions it), and the worker builds leave the import external, pointing at that file beside
 * the worker's own chunk, as `fontkit.js?v=<commit>` so a cached older file (Pages' max-age) is
 * never paired with a newer worker. Only the assembler and analysis workers do (see the plugin).
 */
const FONTKIT = '@cantoo/fontkit';
function sharedFontkit(role: 'emit' | 'import'): Plugin {
  // The PDFium worker keeps its own copy: its script and closure are gated raw
  // (`pdfiumWorker`), and the shared chunk would pull a second shared helper chunk into it.
  let shared = false;
  return {
    name: `recto:shared-fontkit-${role}`,
    apply: 'build',
    enforce: 'pre',
    // The page's build emits the chunk with its exports kept; Rolldown would drop them from
    // an entry nothing in the page imports.
    buildStart(options) {
      if (role === 'import')
        shared = /(?:assembler|analysis)\.worker/.test(JSON.stringify(options.input));
      if (role !== 'emit') return;
      this.emitFile({
        type: 'chunk',
        id: fileURLToPath(new URL('../../packages/engine/src/fontkit-entry.ts', import.meta.url)),
        fileName: 'assets/fontkit.js',
        preserveSignature: 'strict',
      });
    },
    resolveId(source) {
      return shared && source === FONTKIT
        ? { id: `./fontkit.js?v=${appCommit()}`, external: true }
        : null;
    },
  };
}

export default defineConfig({
  base,
  // Declared in src/pwa/env.d.ts; values are JSON so they replace as string literals.
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_COMMIT__: JSON.stringify(appCommit()),
    __BUILD_DATE__: JSON.stringify(buildDate()),
    // The test-only render override (spec X36; src/state/render-quality.ts): compiled in only
    // for the builds Playwright tests, never for the deploy and release builds.
    __RENDER_OVERRIDE__: JSON.stringify(process.env.RECTO_RENDER_OVERRIDE === '1'),
    __TARGET__: JSON.stringify(target),
    __LAB__: JSON.stringify(lab),
  },
  plugins: [
    editionChunks(),
    sharedFontkit('emit'),
    bundleModules(),
    react(),
    // React Compiler (ADR-0003), applied through Babel. Rolldown's filter in the preset
    // limits Babel to files that can contain components or hooks.
    babel({ presets: [reactCompilerPreset()] }),
    // Compiled, typed messages (ADR-0010). Locale resolution is ours (src/i18n/locale.ts
    // overwrites getLocale/setLocale), so the runtime keeps only the base-locale fallback.
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/i18n/paraglide',
      strategy: ['baseLocale'],
      emitReadme: false,
      // Same output as `pnpm i18n` (typecheck and lint run it without Vite).
      emitTsDeclarations: true,
    }),
    // OCR engine and language packs (ADR-0012 §2–§3): serves `ocr/**` in dev and emits it
    // into dist/ocr/ unhashed (`tesseract-<version>/` worker and cores,
    // `lang/<code>.traineddata.gz`), each file checked against
    // packages/engine/ocr/langs.lock.json. Never precached (below).
    ocrAssetsPlugin(),
    // The Office conversion package (ADR-0035 §1): copied into dist/convert/<directory>/ when
    // `packages/engine/office/fetch.ts` has fetched it, each file checked against
    // office.lock.json. Never precached and never in a bundle; downloaded only on consent.
    officeAssetsPlugin(),
    // Offline support (ARCHITECTURE.md §7, ADR-0010). Disabled under Vitest, where
    // `virtual:pwa-register` resolves to a no-op and no service worker is generated.
    VitePWA({
      disable: Boolean(process.env.VITEST),
      registerType: 'prompt',
      // Icons are precached by `workbox.globPatterns` (the large tiles stay out).
      includeManifestIcons: false,
      // Registered by src/pwa/register.ts, which owns the update flow.
      injectRegister: false,
      strategies: 'generateSW',
      // `scope`, `start_url` and `id` all equal Vite's `base`, so a project site at
      // /<repo>/ and a custom domain at / both install correctly.
      manifest: {
        id: base,
        name: 'Recto',
        short_name: 'Recto',
        description:
          'A PDF editor that runs entirely in your browser. Files never leave your device.',
        start_url: base,
        scope: base,
        display: 'standalone',
        lang: 'en',
        // A manifest holds one colour, not one per scheme. It is the dark canvas (ADR-0022 §2.4),
        // the same as the splash's `background_color`, so the launch never flashes a third
        // tone; once the page loads, index.html's `theme-color` metas (one per scheme, set
        // before the first paint by public/theme.js) take over in browsers that honour them.
        theme_color: '#08090c',
        background_color: '#08090c',
        // The Recto mark on its dark tile (docs/brand/README.md, brand plan §5.1; written by
        // tools/media `app-icons`): the rounded tile as `any`, the full-bleed tile as `maskable`.
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell: HTML, JS (including worker and engine chunks), CSS and fonts. The
        // manifest is added by the plugin; of its icons, the SVGs and the 192 px tile (the
        // pattern below). The 512 px tiles (~270 KB together, already compressed) stay out:
        // only the browser reads them, when it installs the app, and no page shows them
        // (docs/research/perf/phone-first-load-2026-10.md). The teaching sample, one file per
        // edition and language (`sample/recto-sample-{en,tr}.pdf` ≤ 125 KB,
        // `sample/recto-sample-phone-{en,tr}.pdf` ≤ 90 KB, all four ≤ 344 KiB: MOB-12 to MOB-14),
        // opens offline once the app has loaded with a connection. Every lazy chunk is a `.js` here,
        // so each split surface opens offline (docs/plan/v1/PLAN.md PF-17, V1-F15); the engine's
        // bundled TTFs (`assets/*.ttf`, embedded by text edits, free text and page furniture)
        // are fonts ≤ 1 MB, precached like the UI's woff2 (ADR-0010).
        // tools/qa/bundle-budget.ts fails the build check when an emitted file is left out.
        globPatterns: [
          '**/*.{html,js,css,woff2,ttf}',
          'sample/*.pdf',
          'icons/*.svg',
          'icons/icon-192.png',
        ],
        // Wasm is runtime-cached (below); the 404 page is not part of the app shell.
        // `worker-engine-*.js` is EmbedPDF's own worker engine, the adapter's lazy default
        // factory: the app always passes a factory (ADR-0011), so it is never loaded. `ocr/`
        // (tesseract's worker, cores and ~22 MB of packs) downloads only when OCR is used
        // (ADR-0012 §4).
        // `media/` (the about page's clips, posters and the media run's request log) is added
        // to the site by the deploy job and is never precached (presentation spec §2.6).
        // `lab/` (the glass lab, GLS-1) is a page beside the app, never part of its shell.
        // `convert/` (the Office conversion package, ~79 MB) downloads only on consent and is
        // stored by its own download manager (ADR-0035 §1, §4).
        globIgnores: [
          '**/*.wasm',
          '404.html',
          '**/worker-engine-*.js',
          'ocr/**',
          'media/**',
          'lab/**',
          'convert/**',
        ],
        maximumFileSizeToCacheInBytes: MAX_PRECACHE_BYTES,
        // The plugin's default treats everything under `assets/` as content-hashed, so it is
        // precached without a revision. `assets/fontkit.js` is the one unhashed file there
        // (`sharedFontkit`): it names a hashed chunk, so it keeps a revision and updates with it.
        dontCacheBustURLsMatching: /^assets\/(?!fontkit\.js$)/,
        manifestTransforms: [
          (entries) => {
            const fonts = /\.(woff2?|ttf|otf)$/;
            const manifest = entries.filter(
              (entry) => !(fonts.test(entry.url) && entry.size > MAX_PRECACHED_FONT_BYTES),
            );
            return Promise.resolve({ manifest, warnings: [] });
          },
        ],
        // Resolved against the service worker URL, so it honours `base`. Only the app's
        // own entry (with any query, e.g. ?lang=tr) falls back; other paths keep their
        // real 404 (ADR-0004: no SPA redirect trick).
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [new RegExp(`^${escapeRegExp(base)}(index\\.html)?(\\?.*)?$`)],
        // Take control on first install so the first session is cached too. Updates
        // still wait for the user (registerType 'prompt').
        clientsClaim: true,
        // The Office conversion's part of the worker (public/sw-office.js, ADR-0035 §4): it
        // serves `convert/**` from the package's own cache and, once the package is on the
        // device, adds the cross-origin isolation headers to the app's page and workers. It
        // registers its fetch listener before Workbox's, and does nothing for anyone else.
        importScripts: ['sw-office.js'],
        cleanupOutdatedCaches: true,
        // Workbox's defaults, and `r`: the cache-busting query of a launch chunk imported
        // again (src/pwa/boot-reload.ts, PRD-26) and a worker's `fontkit.js?v=` still find the precache, so the retry
        // works offline. The precache answers the same bytes as the first try then; a retry
        // that must reach the network is the reload's (a cache-busted document, `_r`).
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^r$/, /^v$/],
        // Match callbacks are serialized into the service worker, so they cannot close over
        // `base`: `location` there is the worker script's URL, which sits at `base`.
        runtimeCaching: [
          {
            // OCR (ADR-0012 §4): the versioned tesseract directory and the language packs,
            // added on first use or by "Keep available offline" (the pack loader writes the
            // same cache and deletes old versions). No expiration: evicting a pack the user
            // kept offline would silently break offline OCR. Matched before the wasm rule.
            urlPattern: ({ url }) => url.href.startsWith(new URL('ocr/', location.href).href),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdf-editor-ocr',
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Content-hashed engine wasm: fetched once, then served from cache. The OCR cores
            // are not (their cache is above), so they cannot evict PDFium or qpdf, and neither
            // is LibreOffice (sw-office.js serves it from its own cache, ADR-0035 §4).
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              url.pathname.endsWith('.wasm') &&
              !url.href.startsWith(new URL('ocr/', location.href).href) &&
              !url.href.startsWith(new URL('convert/', location.href).href),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdf-editor-wasm',
              expiration: { maxEntries: 4, maxAgeSeconds: 180 * DAY_SECONDS },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Fonts too large to precache.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\.(woff2?|ttf|otf)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdf-editor-fonts',
              expiration: { maxEntries: 24, maxAgeSeconds: 180 * DAY_SECONDS },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '#platform': fileURLToPath(new URL(`./src/platform/${target}/index.ts`, import.meta.url)),
    },
  },
  worker: {
    format: 'es',
    plugins: () => [sharedFontkit('import')],
    rolldownOptions: { treeshake: { moduleSideEffects: EMBEDPDF_ENGINES_PURE } },
  },
  build: {
    // Never inline fonts or wasm as data: URLs: the CSP allows `font-src 'self'` only, and
    // a data: font (Vite inlined a 2 KB subset once) is silently blocked.
    assetsInlineLimit: (filePath) =>
      /\.(woff2?|ttf|otf|wasm)$/.test(filePath) ? false : undefined,
    rolldownOptions: {
      treeshake: { moduleSideEffects: EMBEDPDF_ENGINES_PURE },
      output: {
        // The glass lab's script stays under `lab/glass/` beside its page (GLS-1), out of
        // `assets/` and the precache; every other entry keeps Vite's default name.
        entryFileNames: (chunk) =>
          chunk.name === 'glassLab' ? 'lab/glass/[name]-[hash].js' : 'assets/[name]-[hash].js',
        // Stable shared chunks (bundle budgets, PLAN.md §2.3 V1-P2): without them, every lazy
        // module that loads at its first use (motion/lazy.ts) splits the code it shares with
        // the first load (React, the i18n runtime, the motion core) out of the chunks that
        // hold it, into fragments that each edition then loads separately. The motion core's
        // gestures and editor-only modules (container transform, navigation push, disclosure,
        // lazy loading) stay out, so the compact edition does not load them.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /[\\/]node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?(?:react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: 'i18n',
              test: /[\\/]src[\\/]i18n[\\/](?:index|locale|format|use-locale)\.ts$|[\\/]src[\\/]i18n[\\/]paraglide[\\/](?:runtime|registry)\.js$/,
              priority: 25,
            },
            // Vite's preload helper, which every chunk with a dynamic import calls: on its own,
            // so engine chunks never reach the entry (and React) through it (PF-2).
            {
              name: 'preload-helper',
              test: /vite\/preload-helper/,
              priority: 22,
            },
            {
              name: 'motion',
              test: /[\\/]src[\\/]motion[\\/](?!gesture[\\/]|container\.ts$|nav-push\.ts$|disclose\.ts$|lazy\.ts$)/,
              priority: 20,
            },
            // Each edition's chunk a facade of its module alone (PRD-26): see `editionGroups`.
            { name: editionGroups(), priority: 10, includeDependenciesRecursively: false },
          ],
        },
      },
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        // Static "not found" page for GitHub Pages. Built as an HTML entry (not copied from
        // `public/`) so that `%BASE_URL%` is substituted; no SPA redirect trick (ADR-0004).
        notFound: fileURLToPath(new URL('./404.html', import.meta.url)),
        // The about page (presentation spec §3): plain HTML and CSS beside the app, built to
        // about/index.html. It loads none of the app's code.
        about: fileURLToPath(new URL('./about/index.html', import.meta.url)),
        // The glass lab (docs/research/23-liquid-glass-lab.md, decisions GLS-1): a standalone
        // page at lab/glass/, never loaded by the app, sharing no module with it.
        glassLab: fileURLToPath(new URL('./lab/glass/index.html', import.meta.url)),
      },
    },
  },
});
