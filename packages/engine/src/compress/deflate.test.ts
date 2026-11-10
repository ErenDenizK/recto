import { unzlibSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deflateZlib, hasNativeDeflate, NATIVE_DEFLATE_MIN_BYTES } from './deflate';
import { encodeGray, encodeIndexed } from './encode';

/** Compressible raster-like bytes: runs and a slow gradient, as palette indices are. */
function raster(length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = (i >> 6) % 7 === 0 ? (i >> 9) & 0xff : 0x20;
  return out;
}

describe('deflateZlib', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has the native compressor in the browsers the app targets', () => {
    expect(hasNativeDeflate()).toBe(true);
  });

  it('compresses a large input natively into valid zlib that inflates to the input', async () => {
    const data = raster(NATIVE_DEFLATE_MIN_BYTES * 8);
    const out = await deflateZlib(data);
    // RFC 1950 header (deflate, 32 KiB window) and a real saving.
    expect(out[0]).toBe(0x78);
    expect(out.length).toBeLessThan(data.length / 4);
    expect(unzlibSync(out)).toEqual(data);
  });

  it('keeps the JS encoder for a small input', async () => {
    const stream = vi.spyOn(globalThis, 'CompressionStream');
    const data = raster(NATIVE_DEFLATE_MIN_BYTES - 1);
    const out = await deflateZlib(data);
    expect(stream).not.toHaveBeenCalled();
    expect(unzlibSync(out)).toEqual(data);
  });

  it('falls back to the JS encoder where CompressionStream is missing', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    expect(hasNativeDeflate()).toBe(false);
    const data = raster(NATIVE_DEFLATE_MIN_BYTES * 2);
    expect(unzlibSync(await deflateZlib(data))).toEqual(data);
  });

  it('falls back to the JS encoder when the native stream fails', async () => {
    vi.stubGlobal(
      'CompressionStream',
      vi.fn(() => {
        throw new Error('not supported');
      }),
    );
    const data = raster(NATIVE_DEFLATE_MIN_BYTES * 2);
    expect(unzlibSync(await deflateZlib(data))).toEqual(data);
  });
});

describe('image encoders on the native path', () => {
  it('encodeGray round-trips the grey samples', async () => {
    const side = 400;
    const rgba = new Uint8ClampedArray(side * side * 4);
    for (let i = 0; i < side * side; i++) {
      const v = ((i % side) >> 4) * 9;
      rgba.set([v, v, v, 255], i * 4);
    }
    const out = await encodeGray(rgba);
    const samples = unzlibSync(out);
    expect(samples.length).toBe(side * side);
    for (let i = 0; i < samples.length; i += 997) expect(samples[i]).toBe(rgba[i * 4]);
  });

  it('encodeIndexed round-trips the palette indices', async () => {
    const side = 400;
    const colours = [0x000000, 0xff0000, 0x00ff00, 0x0000ff];
    const rgba = new Uint8ClampedArray(side * side * 4);
    for (let i = 0; i < side * side; i++) {
      const rgb = colours[(i >> 5) % colours.length] as number;
      rgba.set([(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, 255], i * 4);
    }
    const out = await encodeIndexed(rgba, colours);
    const indices = unzlibSync(out.data);
    expect(out.hival).toBe(3);
    expect(indices.length).toBe(side * side);
    for (let i = 0; i < indices.length; i += 997) expect(indices[i]).toBe((i >> 5) % 4);
  });
});
