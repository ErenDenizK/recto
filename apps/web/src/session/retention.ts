/**
 * Retention of kept documents (ADR-0032 §2.7; the owner's answer 2 of 2026-10-04): closed
 * documents stay in Recents for 30 days or until everything kept passes 500 MB, oldest
 * first. Open documents (a tab's session) are never expired: they are the work on screen.
 *
 * Files are shared: a source's bytes serve every snapshot that names its id, so a size is
 * the size of the unique files a set of snapshots needs, and a file is deleted only when no
 * session and no remaining kept record names it. Files younger than `graceMs` are left
 * alone, since another tab may have written them a moment before its manifest.
 */
import type { StoredFileInfo } from './storage';

export const RETENTION_DAYS = 30;
export const RETENTION_MAX_AGE_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const RETENTION_MAX_BYTES = 500 * 1024 * 1024;
/** Unreferenced files at least this old are deleted. */
export const RETENTION_GRACE_MS = 60_000;

/** A kept record as retention sees it. */
export interface KeptUsage {
  readonly id: string;
  readonly keptAt: number;
  /** The files it needs, as `folder/name` keys (its own record included). */
  readonly files: readonly string[];
}

export interface RetentionInput {
  readonly now: number;
  readonly kept: readonly KeptUsage[];
  /** Files the sessions of open tabs need (their manifests included). */
  readonly live: ReadonlySet<string>;
  /** Every stored file, by `folder/name`. */
  readonly stored: ReadonlyMap<string, StoredFileInfo>;
  readonly maxAgeMs?: number;
  readonly maxBytes?: number;
  readonly graceMs?: number;
}

export interface RetentionPlan {
  /** Kept records to delete, oldest first. */
  readonly expired: readonly string[];
  /** Stored files no session or remaining kept record needs (`folder/name`). */
  readonly unreferenced: readonly string[];
  /** Bytes kept once the plan has run. */
  readonly bytes: number;
}

function sizeOf(files: Iterable<string>, stored: ReadonlyMap<string, StoredFileInfo>): number {
  let total = 0;
  for (const key of files) total += stored.get(key)?.size ?? 0;
  return total;
}

/** What to delete: records past 30 days, then the oldest until 500 MB fits, then orphans. */
export function planRetention(input: RetentionInput): RetentionPlan {
  const maxAge = input.maxAgeMs ?? RETENTION_MAX_AGE_MS;
  const maxBytes = input.maxBytes ?? RETENTION_MAX_BYTES;
  const grace = input.graceMs ?? RETENTION_GRACE_MS;
  const expired: string[] = [];
  const remaining: KeptUsage[] = [];
  for (const record of [...input.kept].sort((a, b) => a.keptAt - b.keptAt)) {
    if (input.now - record.keptAt > maxAge) expired.push(record.id);
    else remaining.push(record);
  }
  const needed = (): Set<string> => {
    const set = new Set(input.live);
    for (const record of remaining) for (const file of record.files) set.add(file);
    return set;
  };
  let keep = needed();
  let bytes = sizeOf(keep, input.stored);
  while (bytes > maxBytes && remaining.length > 0) {
    const oldest = remaining.shift() as KeptUsage;
    expired.push(oldest.id);
    keep = needed();
    bytes = sizeOf(keep, input.stored);
  }
  const unreferenced: string[] = [];
  for (const [key, info] of input.stored) {
    if (keep.has(key)) continue;
    // Records of expired documents go at once; data files only after the grace period.
    const record = key.startsWith('kept/');
    if (record || input.now - info.lastModified >= grace) unreferenced.push(key);
  }
  return { expired, unreferenced, bytes };
}
