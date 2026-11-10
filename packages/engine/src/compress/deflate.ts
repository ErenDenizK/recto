/**
 * zlib (RFC 1950, a PDF `/FlateDecode` stream) compression for the image pass. Raster data
 * runs through the browser's own `CompressionStream('deflate')`, native zlib: fflate's
 * level 9 took 2.0 s on 25 MB of raster where C zlib takes 65 ms (31×; the R33 audit). Small
 * inputs, and a browser without `CompressionStream` in workers, keep fflate, so the output is
 * always valid zlib and decodes the same.
 *
 * The native stream has no level knob (the engine's default, level 6 in every browser's
 * zlib), so its output can be a little larger than fflate's level 9; the qpdf pass that
 * follows the image pass recompresses Flate streams at level 9 either way (compress.ts).
 */
import { zlibSync } from 'fflate';

/** Below this the stream's set-up costs more than fflate's whole run. */
export const NATIVE_DEFLATE_MIN_BYTES = 64 * 1024;

/** Whether this thread has the native compressor. */
export function hasNativeDeflate(): boolean {
  return typeof CompressionStream === 'function' && typeof Blob === 'function';
}

async function nativeDeflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** `data` as zlib: native where the input is large and the browser can, else fflate at `level`. */
export async function deflateZlib(data: Uint8Array, level: 6 | 9 = 9): Promise<Uint8Array> {
  if (data.length >= NATIVE_DEFLATE_MIN_BYTES && hasNativeDeflate()) {
    try {
      return await nativeDeflate(data);
    } catch {
      // A browser that has the constructor but fails the stream: the JS path below.
    }
  }
  return zlibSync(data, { level });
}
