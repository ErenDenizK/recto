/* eslint-disable -- temporary CI probe (r26/ci-probe-office-*), never merged */
/**
 * Temporary probe: the package's converter worker started fresh N times on an isolated page
 * served here (COOP/COEP), each converting report.docx (and then two more), logging how long
 * each LibreOffice call took, any pthread crash, and any conversion that never answered.
 * PROBE_ENV (JSON) is set into LibreOffice's ENV before its runtime starts.
 */
import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test } from '@playwright/test';

import { docx } from './support/docx';

const lock = { directory: 'lo-2.7.2-r2' };
const pkg = fileURLToPath(new URL(`../dist/convert/${lock.directory}/`, import.meta.url));
const ENV = process.env.PROBE_ENV ?? '';
const CYCLES = Number(process.env.PROBE_CYCLES ?? 8);
const COUNT = Number(process.env.PROBE_COUNT ?? 3);
const PORT = 4475;

const WRAPPER = `
const env = JSON.parse(new URL(self.location.href).searchParams.get('env') || '{}');
let mod;
Object.defineProperty(self, 'Module', { configurable: true, enumerable: true,
  get() { return mod; },
  set(v) {
    if (v && typeof v === 'object' && !v.__probe) {
      v.__probe = true;
      const pre = v.preRun ? [].concat(v.preRun) : [];
      pre.push(() => { Object.assign(v.ENV, env); console.log('[probe] ENV set ' + JSON.stringify(env)); });
      v.preRun = pre;
    }
    mod = v;
  } });
importScripts('/convert/browser.worker.global.js');
`;

const PAGE = `<!doctype html><meta charset="utf-8"><title>probe</title><script>
const base = location.origin + '/convert/';
window.cycle = async function (env, count) {
  const url = env ? '/wrapper.js?env=' + encodeURIComponent(env) : base + 'browser.worker.global.js';
  const w = new Worker(url, { name: 'office-converter' });
  const out = { events: [], crash: null };
  const t0 = performance.now();
  const at = () => Math.round(performance.now() - t0);
  w.onerror = (e) => { e.preventDefault(); out.crash = out.crash || { at: at(), message: e.message }; };
  let id = 0;
  const ask = (msg, timeout) => new Promise((resolve) => {
    const my = ++id;
    const timer = setTimeout(() => resolve({ type: 'timeout', at: at() }), timeout);
    w.onmessage = (ev) => {
      const m = ev.data;
      if (m.id !== my || m.type === 'progress') return;
      clearTimeout(timer);
      resolve({ type: m.type, error: m.error, size: m.data && m.data.length, at: at() });
    };
    w.postMessage(Object.assign({}, msg, { id: my }));
  });
  const init = await ask({ type: 'init', sofficeJs: base + 'soffice.js', sofficeWasm: base + 'soffice.wasm',
    sofficeData: base + 'soffice.data', sofficeWorkerJs: base + 'soffice.worker.js' }, 180000);
  out.events.push(Object.assign({ step: 'init' }, init));
  if (init.type === 'ready') {
    const bytes = new Uint8Array(await (await fetch('/report.docx')).arrayBuffer());
    for (let i = 0; i < count; i++) {
      const start = at();
      const r = await ask({ type: 'convert', inputData: bytes.slice(), inputExt: 'docx', outputFormat: 'pdf' }, 150000);
      out.events.push(Object.assign({ step: 'convert', start, crashBefore: out.crash ? out.crash.at : null }, r));
      if (r.type !== 'result') break;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  w.terminate();
  return out;
};
</script>`;

test('probe: fresh converter workers', async ({ browser }) => {
  test.setTimeout(40 * 60_000);
  const report = docx(['First page: Recto converts this.', 'İkinci sayfa: ğüşiöç.', 'Third page.']);
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const headers: Record<string, string> = {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cache-Control': 'no-store',
    };
    if (url.pathname === '/') {
      res.writeHead(200, { ...headers, 'Content-Type': 'text/html' });
      res.end(PAGE);
      return;
    }
    if (url.pathname === '/wrapper.js') {
      res.writeHead(200, { ...headers, 'Content-Type': 'text/javascript' });
      res.end(WRAPPER);
      return;
    }
    if (url.pathname === '/report.docx') {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/octet-stream' });
      res.end(report);
      return;
    }
    let file = join(pkg, url.pathname.replace('/convert/', ''));
    let gz = false;
    if (!existsSync(file) && existsSync(`${file}.gz`)) {
      file = `${file}.gz`;
      gz = true;
    }
    if (!existsSync(file)) {
      res.writeHead(404, headers);
      res.end();
      return;
    }
    const ext = file.replace(/\.gz$/, '').split('.').pop();
    headers['Content-Type'] =
      ext === 'js'
        ? 'text/javascript'
        : ext === 'wasm'
          ? 'application/wasm'
          : 'application/octet-stream';
    if (gz) headers['Content-Encoding'] = 'gzip';
    res.writeHead(200, headers);
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  const summary: string[] = [];
  for (let i = 0; i < CYCLES; i++) {
    const page = await browser.newPage();
    const t0 = Date.now();
    page.on('console', (m) => {
      const t = m.text();
      if (
        /lok_documentLoad|lok_documentSaveAs ret|lok_documentDestroy done|AutoRecovery|length_error|Pthread|uncaught|\[probe\]|abort|unwind/i.test(
          t,
        )
      )
        console.log(`[probe #${i} +${Date.now() - t0}] ${t.slice(0, 240)}`);
    });
    page.on('pageerror', (e) =>
      console.log(`[probe #${i} +${Date.now() - t0}] pageerror ${e.message}`),
    );
    await page.goto(`http://localhost:${PORT}/`);
    const out = await page.evaluate(([env, count]) => (window as any).cycle(env, count), [
      ENV,
      COUNT,
    ] as const);
    const line = `[probe-result #${i}] env=${ENV || 'none'} ${JSON.stringify(out)}`;
    console.log(line);
    summary.push(line);
    await page.close();
  }
  server.close();
  console.log(`[probe-summary]\n${summary.join('\n')}`);
});
