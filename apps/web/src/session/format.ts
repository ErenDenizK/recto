/**
 * The snapshot files (ADR-0032 §2.4), version 1. A tab's **session manifest** holds the
 * history tail (`SerializedHistoryV1`, the last 20 undo steps) and, per open document, where
 * it was shown; a **kept record** holds one closed document as a `SerializedWorkspaceV1` for
 * Recents (§2.6). Both list the files they need: the sources' bytes and the blobs.
 *
 * The model parts are validated by the model package when restored
 * (`deserializeHistoryTail`, `deserializeWorkspace`); everything else here is checked field
 * by field when read, and a record that fails is set aside with a notice, never silently
 * dropped (ADR-0032 §3).
 */
import type {
  DocumentId,
  SerializedHistoryV1,
  SerializedWorkspaceV1,
  SourceId,
} from '@pdf-editor/document-model';

export const SNAPSHOT_FORMAT = 1;

/** The view a document was shown in, and its lock (never Markup: ADR-0032 §2.4). */
export interface DocumentPlace {
  readonly id: DocumentId;
  /** Page index shown last. */
  readonly page: number;
  /** The page view or the light table (Compare is a session place, never restored). */
  readonly view: 'read' | 'arrange';
  /** Read (locked) or Edit. */
  readonly mode: 'read' | 'edit';
  /** The document differs from the file it came from (Recents: "Edited, changes kept"). */
  readonly changed: boolean;
  /**
   * The sources the document is the file of, oldest first (`state/saved-store.ts` origins:
   * Revert reopens them, Save may write through that file's stored handle); empty for a
   * document made from others' pages. Absent in snapshots from before it was kept.
   */
  readonly origins?: readonly SourceId[];
  /**
   * Save wrote over that file, so it no longer holds the opened version (Revert then leaves
   * the document unsaved). Absent in snapshots from before it was kept: unknown, read as true.
   */
  readonly writtenOver?: boolean;
}

/** A source's file facts and its kept bytes (`sources/<id>.pdf`). */
export interface SourceFacts {
  readonly id: SourceId;
  readonly name: string;
  readonly size: number;
  readonly lastModified: number;
}

/** A blob's facts (`blobs/<id>`): image bytes of an image page, or an edit blob. */
export type BlobFacts =
  | {
      readonly id: string;
      readonly kind: 'image';
      readonly type: 'image/png' | 'image/jpeg';
      readonly width: number;
      readonly height: number;
      readonly name: string;
    }
  | { readonly id: string; readonly kind: 'edit'; readonly type: string };

export interface SessionManifestV1 {
  readonly format: 1;
  readonly kind: 'session';
  readonly tabId: string;
  readonly savedAt: number;
  readonly destination: 'home' | 'document';
  readonly zoom: number;
  readonly fitMode: 'width' | 'page' | null;
  readonly history: SerializedHistoryV1;
  /** The present entry's documents, in tab order. */
  readonly documents: readonly DocumentPlace[];
  /** Every source any entry of the tail refers to. */
  readonly sources: readonly SourceFacts[];
  /** Every blob any entry of the tail refers to. */
  readonly blobs: readonly BlobFacts[];
}

export interface KeptRecordV1 {
  readonly format: 1;
  readonly kind: 'kept';
  /** Also the file name (`kept/<id>.json`) and `RecentEntry.kept.snapshotId`. */
  readonly id: string;
  readonly keptAt: number;
  readonly title: string;
  /** The Recents match: the first source's file name and size. */
  readonly name: string;
  readonly size: number;
  readonly pages: number;
  /** The document and only what it needs. */
  readonly workspace: SerializedWorkspaceV1;
  readonly place: DocumentPlace;
  readonly sources: readonly SourceFacts[];
  readonly blobs: readonly BlobFacts[];
}

export const sourceFile = (id: string): string => `${id}.pdf`;
export const recordFile = (id: string): string => `${id}.json`;

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

/** Thrown for a record that cannot be read; its file is set aside, not dropped. */
export class SnapshotFormatError extends Error {
  override readonly name = 'SnapshotFormatError';
}

type Obj = Readonly<Record<string, unknown>>;

function fail(path: string, expected: string): never {
  throw new SnapshotFormatError(`${path}: expected ${expected}`);
}

function obj(value: unknown, path: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'an object');
  return value as Obj;
}

function arr(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) fail(path, 'an array');
  return value;
}

function str(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1024) {
    fail(path, 'a string');
  }
  return value;
}

function id(value: unknown, path: string): string {
  const s = str(value, path);
  if (!/^[A-Za-z0-9._-]{1,190}$/.test(s)) fail(path, 'an id');
  return s;
}

function num(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'a number');
  return value;
}

function count(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(path, 'a count');
  return value as number;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'a boolean');
  return value;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], path: string): T {
  if (!options.includes(value as T)) fail(path, options.join(' or '));
  return value as T;
}

function readPlace(value: unknown, path: string): DocumentPlace {
  const o = obj(value, path);
  return {
    id: id(o.id, `${path}.id`) as DocumentId,
    page: count(o.page, `${path}.page`),
    view: oneOf(o.view, ['read', 'arrange'] as const, `${path}.view`),
    mode: oneOf(o.mode, ['read', 'edit'] as const, `${path}.mode`),
    changed: bool(o.changed, `${path}.changed`),
    ...(o.origins === undefined
      ? {}
      : {
          origins: arr(o.origins, `${path}.origins`).map(
            (s, i) => id(s, `${path}.origins[${i}]`) as SourceId,
          ),
        }),
    ...(o.writtenOver === undefined
      ? {}
      : { writtenOver: bool(o.writtenOver, `${path}.writtenOver`) }),
  };
}

function readSourceFacts(value: unknown, path: string): SourceFacts {
  const o = obj(value, path);
  return {
    id: id(o.id, `${path}.id`) as SourceId,
    name: str(o.name, `${path}.name`),
    size: count(o.size, `${path}.size`),
    lastModified: num(o.lastModified, `${path}.lastModified`),
  };
}

function readBlobFacts(value: unknown, path: string): BlobFacts {
  const o = obj(value, path);
  if (o.kind === 'image') {
    return {
      id: id(o.id, `${path}.id`),
      kind: 'image',
      type: oneOf(o.type, ['image/png', 'image/jpeg'] as const, `${path}.type`),
      width: count(o.width, `${path}.width`),
      height: count(o.height, `${path}.height`),
      name: typeof o.name === 'string' ? o.name.slice(0, 1024) : '',
    };
  }
  if (o.kind === 'edit') {
    return {
      id: id(o.id, `${path}.id`),
      kind: 'edit',
      type: typeof o.type === 'string' ? o.type.slice(0, 128) : '',
    };
  }
  return fail(`${path}.kind`, "'image' or 'edit'");
}

function readHeader(o: Obj, kind: 'session' | 'kept'): void {
  if (o.format !== SNAPSHOT_FORMAT) fail('$.format', String(SNAPSHOT_FORMAT));
  if (o.kind !== kind) fail('$.kind', `'${kind}'`);
}

/** Reads a session manifest (JSON text or value); the history is checked on restore. */
export function parseSessionManifest(input: unknown): SessionManifestV1 {
  const root = obj(typeof input === 'string' ? parseJson(input) : input, '$');
  readHeader(root, 'session');
  return {
    format: 1,
    kind: 'session',
    tabId: id(root.tabId, '$.tabId'),
    savedAt: num(root.savedAt, '$.savedAt'),
    destination: oneOf(root.destination, ['home', 'document'] as const, '$.destination'),
    zoom: num(root.zoom, '$.zoom'),
    fitMode:
      root.fitMode === null ? null : oneOf(root.fitMode, ['width', 'page'] as const, '$.fitMode'),
    history: obj(root.history, '$.history') as unknown as SerializedHistoryV1,
    documents: arr(root.documents, '$.documents').map((d, i) => readPlace(d, `$.documents[${i}]`)),
    sources: arr(root.sources, '$.sources').map((s, i) => readSourceFacts(s, `$.sources[${i}]`)),
    blobs: arr(root.blobs, '$.blobs').map((b, i) => readBlobFacts(b, `$.blobs[${i}]`)),
  };
}

/** Reads a kept record (JSON text or value); the workspace is checked on reopen. */
export function parseKeptRecord(input: unknown): KeptRecordV1 {
  const root = obj(typeof input === 'string' ? parseJson(input) : input, '$');
  readHeader(root, 'kept');
  return {
    format: 1,
    kind: 'kept',
    id: id(root.id, '$.id'),
    keptAt: num(root.keptAt, '$.keptAt'),
    title: str(root.title, '$.title'),
    name: str(root.name, '$.name'),
    size: count(root.size, '$.size'),
    pages: count(root.pages, '$.pages'),
    workspace: obj(root.workspace, '$.workspace') as unknown as SerializedWorkspaceV1,
    place: readPlace(root.place, '$.place'),
    sources: arr(root.sources, '$.sources').map((s, i) => readSourceFacts(s, `$.sources[${i}]`)),
    blobs: arr(root.blobs, '$.blobs').map((b, i) => readBlobFacts(b, `$.blobs[${i}]`)),
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return fail('$', 'JSON');
  }
}
