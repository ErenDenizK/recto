/**
 * Repair of a file that lost its tail (V1-B5, docs/plan/v1/PLAN.md "W0-q findings"): the
 * objects are all there, but the cross-reference table's end, the trailer, `startxref` and
 * `%%EOF` were cut off (an interrupted download or copy).
 *
 * PDFium rebuilds a damaged cross-reference table by scanning for objects, but it takes the
 * document catalog from a trailer; with no trailer left it refuses the file ("the file is
 * damaged"). MuPDF's repair goes one step further and takes the catalog (and the Info
 * dictionary) from the scanned objects themselves. This does the same: it scans the file for
 * `N G obj … endobj`, finds the `/Type /Catalog` object, checks that its page tree and the
 * pages' content streams are whole,
 * and appends a fresh cross-reference table and trailer, which PDFium then reads as an ordinary
 * file. The original bytes are left as they are (the new section follows them, as an
 * incremental update would).
 *
 * It applies only when no trailer survives at all (no `trailer` keyword and no xref stream):
 * every other damage keeps going through PDFium's own repair. It refuses, rather than guess,
 * when the catalog cannot be found, a page of the tree is missing or cut off, or the file was
 * encrypted (its key lived in the lost trailer). The caller still reports the file as repaired
 * (`checkXrefStructure`).
 */

/** How deep a page tree may nest before the walk gives up (cycle guard). */
const MAX_TREE_DEPTH = 64;

interface ScannedObject {
  readonly generation: number;
  readonly offset: number;
  /** The object's source text, from its header to `endobj` (latin1, one char per byte). */
  readonly body: string;
}

/** One char per byte, so string indices are byte offsets. */
function latin1(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

/** Every complete object (header to `endobj`); a later definition of a number wins. */
function scanObjects(text: string): Map<number, ScannedObject> {
  const objects = new Map<number, ScannedObject>();
  const header = /(^|[\r\n])[ \t]*(\d{1,10})[ \t\r\n]+(\d{1,5})[ \t\r\n]+obj\b/g;
  for (let match = header.exec(text); match; match = header.exec(text)) {
    const offset = match.index + (match[1] ?? '').length;
    const bodyStart = header.lastIndex;
    // A stream's data may hold any bytes, `endobj` among them: skip past `endstream` first.
    const nextEnd = text.indexOf('endobj', bodyStart);
    if (nextEnd === -1) break;
    const streamAt = text.indexOf('stream', bodyStart);
    let end = nextEnd;
    const hasStream =
      streamAt !== -1 && streamAt < nextEnd && text.slice(streamAt - 3, streamAt) !== 'end';
    if (hasStream) {
      const endStream = text.indexOf('endstream', streamAt + 6);
      if (endStream === -1) break;
      end = text.indexOf('endobj', endStream + 9);
      if (end === -1) break;
    }
    // A header inside this object's dictionary is an object of its own: the object before it
    // was cut off (no `endobj` of its own), so it is dropped and the scan resumes there.
    const inner = text
      .slice(bodyStart, hasStream ? streamAt : end)
      .search(/[\r\n][ \t]*\d{1,10}[ \t\r\n]+\d{1,5}[ \t\r\n]+obj\b/);
    if (inner !== -1) {
      header.lastIndex = bodyStart + inner;
      continue;
    }
    objects.set(Number(match[2]), {
      generation: Number(match[3]),
      offset,
      body: text.slice(offset, end + 6),
    });
    header.lastIndex = end + 6;
  }
  return objects;
}

/** The object's dictionary text (before any stream data). */
function dictOf(object: ScannedObject): string {
  const stream = object.body.search(/>>\s*stream\b/);
  return stream === -1 ? object.body : object.body.slice(0, stream + 2);
}

function refOf(dict: string, key: string): number | undefined {
  const match = new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R\\b`).exec(dict);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

/**
 * Whether every node of the page tree under `ref` is present, with every page's content
 * streams, and the tree holds at least one page.
 */
function pageTreeWhole(objects: ReadonlyMap<number, ScannedObject>, ref: number): boolean {
  let pages = 0;
  const seen = new Set<number>();
  const walk = (num: number, depth: number): boolean => {
    if (depth > MAX_TREE_DEPTH || seen.has(num)) return false;
    seen.add(num);
    const object = objects.get(num);
    if (!object) return false;
    const dict = dictOf(object);
    if (/\/Type\s*\/Pages\b/.test(dict)) {
      const kids = /\/Kids\s*\[([^\]]*)\]/.exec(dict)?.[1];
      if (kids === undefined) return false;
      const refs = [...kids.matchAll(/(\d+)\s+\d+\s+R\b/g)].map((m) => Number(m[1]));
      return refs.every((kid) => walk(kid, depth + 1));
    }
    if (/\/Type\s*\/Page\b/.test(dict)) {
      pages++;
      // A page whose content stream was cut off would open blank: not a repair.
      const contents = /\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R\b)/.exec(dict)?.[1] ?? '';
      return [...contents.matchAll(/(\d+)\s+\d+\s+R\b/g)].every((m) => objects.has(Number(m[1])));
    }
    return false;
  };
  return walk(ref, 0) && pages > 0;
}

/** The last object that reads as a document Info dictionary (MuPDF's rule, narrowed). */
function findInfo(objects: ReadonlyMap<number, ScannedObject>): number | undefined {
  let info: number | undefined;
  for (const [num, object] of objects) {
    const dict = dictOf(object);
    if (!dict.includes('<<') || /\/(Type|Parent|Subtype|Kids)\b/.test(dict)) continue;
    if (/\/(Producer|Creator|CreationDate|ModDate)\b/.test(dict)) info = num;
  }
  return info;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/**
 * When `bytes` is a PDF that lost only its tail, the same bytes with a new cross-reference
 * table and trailer appended; otherwise `undefined` (sound files, other damage, or a file this
 * cannot repair without guessing).
 */
export function restoreLostTail(bytes: Uint8Array): Uint8Array | undefined {
  const text = latin1(bytes);
  if (!text.startsWith('%PDF-')) return undefined;
  if (/\btrailer\b/.test(text) || /\/Type\s*\/XRef\b/.test(text)) return undefined;
  const objects = scanObjects(text);
  // The key of an encrypted file lived in the lost trailer (/Encrypt, /ID).
  for (const object of objects.values()) {
    if (/\/Filter\s*\/Standard\b/.test(dictOf(object))) return undefined;
  }
  let root: number | undefined;
  for (const [num, object] of objects) {
    if (/\/Type\s*\/Catalog\b/.test(dictOf(object))) root = num;
  }
  if (root === undefined) return undefined;
  const pages = refOf(dictOf(objects.get(root) as ScannedObject), 'Pages');
  if (pages === undefined || !pageTreeWhole(objects, pages)) return undefined;
  const info = findInfo(objects);

  const size = Math.max(...objects.keys()) + 1;
  const separator = text.endsWith('\n') || text.endsWith('\r') ? '' : '\n';
  const xrefAt = bytes.length + separator.length;
  let section = `${separator}xref\n0 ${size}\n0000000000 65535 f\r\n`;
  for (let num = 1; num < size; num++) {
    const object = objects.get(num);
    section += object
      ? `${pad(object.offset, 10)} ${pad(object.generation, 5)} n\r\n`
      : '0000000000 00000 f\r\n';
  }
  const rootGen = (objects.get(root) as ScannedObject).generation;
  const infoEntry =
    info === undefined ? '' : ` /Info ${info} ${(objects.get(info) as ScannedObject).generation} R`;
  section +=
    `trailer\n<< /Size ${size} /Root ${root} ${rootGen} R${infoEntry} >>\n` +
    `startxref\n${xrefAt}\n%%EOF\n`;
  const tail = new Uint8Array(section.length);
  for (let i = 0; i < section.length; i++) tail[i] = section.charCodeAt(i);
  const out = new Uint8Array(bytes.length + tail.length);
  out.set(bytes, 0);
  out.set(tail, bytes.length);
  return out;
}
