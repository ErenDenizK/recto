/**
 * `pnpm readme`: the README's own copies of the media (DSN-97), committed under `docs/media/`
 * so the GitHub page does not depend on the live site. Reads the `readme` entry of
 * `budgets.json`: each file names the scene it comes from. A still is the scene's WebP; a clip
 * is its README GIF, or, when the entry gives a `width`, a GIF encoded again from the scene's
 * frames at that width and 12 fps, for clips whose 1200 px GIF is over the per-file limit.
 * Run after `capture` and `encode`; fails on a file over `fileLimit` or a total over `limit`.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { BUDGETS_FILE, MEDIA_DIR, README_MEDIA_DIR, sceneDir } from './paths.ts';

export interface ReadmeEntry {
  /** The scene id (`11-home`, `03-redact`). */
  readonly scene: string;
  /** Clips only: encode again from the frames at this width instead of copying the GIF. */
  readonly width?: number;
}

export interface ReadmeBudget {
  readonly limit: number;
  readonly fileLimit: number;
  readonly files: Readonly<Record<string, ReadmeEntry>>;
}

/** A smaller GIF from the scene's own frames, with the palette settings of `encode`. */
function regif(scene: string, width: number, out: string): void {
  const dir = sceneDir(scene);
  execFileSync(
    'ffmpeg',
    [
      ...['-hide_banner', '-loglevel', 'error', '-y'],
      ...['-f', 'concat', '-safe', '0', '-i', join(dir, 'frames.ffconcat')],
      '-filter_complex',
      [
        `[0:v]fps=12,scale=${width}:-2:flags=lanczos,split[s0][s1]`,
        '[s0]palettegen=stats_mode=full[p]',
        '[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
      ].join(';'),
      ...['-loop', '0', out],
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );
}

function main(): number {
  const { readme } = JSON.parse(readFileSync(BUDGETS_FILE, 'utf8')) as { readme: ReadmeBudget };
  mkdirSync(README_MEDIA_DIR, { recursive: true });
  let total = 0;
  let failures = 0;
  for (const [name, entry] of Object.entries(readme.files)) {
    const out = join(README_MEDIA_DIR, name);
    if (name.endsWith('.gif') && entry.width) regif(entry.scene, entry.width, out);
    else {
      const source = join(MEDIA_DIR, `${entry.scene}${name.slice(name.lastIndexOf('.'))}`);
      if (!existsSync(source)) throw new Error(`${name}: ${source} is missing; run encode`);
      copyFileSync(source, out);
    }
    const size = statSync(out).size;
    total += size;
    const ok = size <= readme.fileLimit;
    if (!ok) failures += 1;
    console.log(
      `${name.padEnd(16)} ${(size / 1000).toFixed(1).padStart(8)} KB  ${ok ? 'ok' : 'OVER'}`,
    );
  }
  const ok = total <= readme.limit;
  if (!ok) failures += 1;
  console.log(
    `${'total'.padEnd(16)} ${(total / 1000).toFixed(1).padStart(8)} KB  ${ok ? 'ok' : 'OVER'}`,
  );
  return failures > 0 ? 1 : 0;
}

process.exitCode = main();
