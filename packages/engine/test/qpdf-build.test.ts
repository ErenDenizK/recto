/**
 * The committed qpdf wasm is the one `qpdf/build.sh` produces (ADR-0008; P-7,
 * docs/plan/v1/PLAN.md §3.2 and V1-B4). The weekly rebuild in `.github/workflows/qpdf-wasm.yml`
 * compares bytes; these checks catch the cheap half locally: the build record names the bytes
 * that are committed, and the one date the toolchain would write into the binary (libjpeg-turbo's
 * build string) is the pinned one, not the day of the build.
 */
import { describe, expect, it } from 'vitest';

import buildScript from '../qpdf/build.sh?raw';
import buildInfo from '../qpdf/dist/BUILD-INFO.txt?raw';
import qpdfWasmUrl from '../qpdf/dist/qpdf.wasm?url';

async function wasmBytes(): Promise<Uint8Array> {
  const response = await fetch(qpdfWasmUrl);
  return new Uint8Array(await response.arrayBuffer());
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

describe('qpdf wasm build (P-7)', () => {
  it('BUILD-INFO.txt records the SHA-256 of the committed qpdf.wasm', async () => {
    const recorded = /^([0-9a-f]{64}) {2}qpdf\.wasm$/m.exec(buildInfo)?.[1];
    expect(recorded).toBeDefined();
    expect(await sha256(await wasmBytes())).toBe(recorded);
  });

  it("pins libjpeg-turbo's build string, and the committed wasm carries the pinned one", async () => {
    const pinned = /^LIBJPEG_TURBO_BUILD=(\d{8})$/m.exec(buildScript)?.[1];
    expect(pinned).toBeDefined();
    expect(buildScript).toContain('"-DBUILD=$LIBJPEG_TURBO_BUILD"');
    const text = new TextDecoder('latin1').decode(await wasmBytes());
    const builds = [...text.matchAll(/libjpeg-turbo version [\d.]+ \(build (\d{8})\)/g)].map(
      (match) => match[1],
    );
    expect(builds).toEqual([pinned]);
  });
});
