/**
 * The teaching sample (docs/specs/redesign.md §11.5 D4-2; components/02-library.md §11, L10;
 * flows.md §9.2): a four-page A4 PDF in English and Turkish whose text teaches the everyday
 * acts, with no overlay tour. The app opens it from the Library's "Try the sample", ⌘K and
 * `?sample` / `?sample=tr` (apps/web/src/sample/).
 *
 *   pnpm --filter @pdf-editor/fixtures-tool sample          # (re)write apps/web/public/sample/
 *   pnpm --filter @pdf-editor/fixtures-tool sample --check  # rebuild in memory, compare
 *
 *   page 1  Welcome: one paragraph to select and highlight, a 40 % margin to write in
 *   page 2  A form: Name, Date, a checkbox, and a place to sign with Fill & sign
 *   page 3  A greyscale scan of a short letter: an image with no text layer (Recognize text)
 *   page 4  Four page miniatures: the Pages grid, and how changes are kept and saved
 *
 * Everything is made here: text in subsets of the bundled OFL fonts (Inter Regular and Bold,
 * Noto Serif Regular; packages/engine/assets/fonts/LICENSES.md), shapes as path operators,
 * and the scan rasterised by lib/raster.ts from Inter's glyph outlines, as the demo letter
 * scan is (demo-fixtures.ts). The PDF is tagged (headings, paragraphs, the form's fields with
 * their names, alt text for the miniatures and the scan) and carries `/Lang`. The sender and
 * every name are invented; each page says "fictional data".
 *
 * Determinism follows the rest of the corpus: fixed Info dates, a trailer /ID from the file
 * name, fixed subset tags, and a PRNG seeded from the file name for the scan's dust, so a
 * rebuild with the same `@cantoo/pdf-lib` and Node zlib is byte-identical (the unit test and
 * `--check` hold it to that), and each file stays within SAMPLE_MAX_BYTES (02.14).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PDFDict,
  type PDFDocument,
  type PDFFont,
  PDFHexString,
  PDFName,
  PDFNumber,
  type PDFObject,
  PDFOperator,
  PDFOperatorNames,
  type PDFPage,
  type PDFRef,
  PDFString,
  appendBezierCurve,
  beginText,
  closePath,
  endText,
  fill,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  setCharacterSpacing,
  setDashPattern,
  setFillingRgbColor,
  setFontAndSize,
  setLineCap,
  setLineWidth,
  setStrokingRgbColor,
  setTextMatrix,
  showText,
  stroke,
} from '@cantoo/pdf-lib';
import { A4, newDoc, round2, save } from './lib/build.ts';
import { REPO_ROOT, sha256, withDeterministicRandom, seededRandom } from './lib/common.ts';
import { Canvas, type PathCommand } from './lib/raster.ts';

export type SampleLocale = 'en' | 'tr';
export const SAMPLE_LOCALES: readonly SampleLocale[] = ['en', 'tr'];
/** Where the app serves them from (`sample/recto-sample-{en,tr}.pdf`, precached). */
export const SAMPLE_DIR = join(REPO_ROOT, 'apps', 'web', 'public', 'sample');
export const sampleFile = (locale: SampleLocale): string => `recto-sample-${locale}.pdf`;
/** Each file's cap (02.14: ≤ 125 KB each, 250 KB both; the performance budget is 250 KB). */
export const SAMPLE_MAX_BYTES = 125 * 1024;
/** 1-based: the page that is a picture with no text layer (the facts chip's "No text on 1 page"). */
export const SAMPLE_SCAN_PAGE = 3;
export const SAMPLE_PAGE_COUNT = 4;
export const SAMPLE_FIELDS = ['name', 'date', 'tried'] as const;

const CREATOR = 'Recto sample generator (tools/fixtures/sample-fixture.ts)';
const FONT_DIR = join(REPO_ROOT, 'packages', 'engine', 'assets', 'fonts');
const [PAGE_W, PAGE_H] = A4;
const LEFT = 64;
const RIGHT = PAGE_W - 64;
const CONTENT_W = RIGHT - LEFT;
const r2 = round2;

// ---------------------------------------------------------------------------
// Copy (Turkish in the siz register, BR-V3; the strings of 02-library §11 where it gives them)
// ---------------------------------------------------------------------------

interface SampleCopy {
  lang: string;
  title: string;
  subject: string;
  kicker: string;
  footer: string;
  outline: [string, string, string, string];
  welcome: {
    title: string;
    paragraph: string;
    tries: string[];
    margin: string;
  };
  form: {
    title: string;
    intro: string;
    card: string;
    cardNote: string;
    name: string;
    date: string;
    tried: string;
    signature: string;
    signHere: string;
  };
  scan: {
    alt: string;
    sender: string[];
    date: string;
    salutation: string;
    paragraphs: string[];
    closing: string;
    signer: string;
  };
  pages: {
    title: string;
    grid: string;
    alt: string;
    keptTitle: string;
    kept: string;
    copy: string;
    end: string;
  };
}

const COPY: Record<SampleLocale, SampleCopy> = {
  en: {
    lang: 'en',
    title: 'Recto sample',
    subject: 'A four-page PDF that shows what to try in Recto. Fictional data.',
    kicker: 'RECTO SAMPLE',
    footer: 'Recto sample · fictional data',
    outline: ['Welcome', 'Fill in a form', 'A scanned page', 'Arrange and save'],
    welcome: {
      title: 'Welcome to Recto.',
      paragraph:
        'Recto reads, marks up, signs and arranges PDFs right in your browser, and nothing you open here leaves this device. This sample is an ordinary PDF, so whatever you try on it works the same on your own files. Select this sentence and choose Highlight.',
      tries: [
        'Press M or tap Markup to write in the margin.',
        'Right-click or long-press a page for more.',
        'To change the words themselves, select them and choose Edit text.',
      ],
      margin: 'NOTES',
    },
    form: {
      title: 'Fill in a form',
      intro:
        'Click a field and type. The fields belong to the PDF, so what you enter is saved in the file and shows in any PDF reader.',
      card: 'Guest book',
      cardNote: 'Leave your name, then sign.',
      name: 'Name',
      date: 'Date',
      tried: 'I tried Recto.',
      signature: 'Signature',
      signHere: 'Sign here with Fill & sign.',
    },
    scan: {
      alt: 'Scanned letter, no text layer',
      sender: ['Ada Lindqvist', '4 Linden Row, Northam'],
      date: '6 October 2026',
      salutation: 'Dear reader,',
      paragraphs: [
        'This page is a picture: a scan of a short letter, with no text behind it. You cannot select or search these words yet.',
        'Recognize text makes it searchable. It reads the words in the image and adds an invisible text layer, so you can select, search and copy them. Like everything in Recto, it runs on this device.',
      ],
      closing: 'Kind regards,',
      signer: 'Ada Lindqvist',
    },
    pages: {
      title: 'Arrange pages',
      grid: 'Press 3 or pinch to see every page. Drag a thumbnail to move it.',
      alt: 'Miniatures of the four pages of this sample, the third one selected',
      keptTitle: 'Kept, then saved',
      kept: 'Your changes are kept on this device. Save writes them into the file.',
      copy: 'Save a copy writes a new file and leaves this one as it is.',
      end: 'That is the whole tour. Open your own PDFs whenever you are ready.',
    },
  },
  tr: {
    lang: 'tr',
    title: 'Recto örnek belge',
    subject: 'Recto’da neleri deneyebileceğinizi gösteren dört sayfalık bir PDF. Kurgusal veriler.',
    kicker: 'RECTO ÖRNEK BELGE',
    footer: 'Recto örnek belge · kurgusal veriler',
    outline: ['Hoş geldiniz', 'Bir form doldurun', 'Taranmış bir sayfa', 'Düzenleyin ve kaydedin'],
    welcome: {
      title: 'Recto’ya hoş geldiniz.',
      paragraph:
        'Recto, PDF’leri doğrudan tarayıcınızda okur, işaretler, imzalar ve düzenler; burada açtığınız hiçbir şey bu cihazdan çıkmaz. Bu örnek sıradan bir PDF’dir, yani burada denediğiniz her şey kendi dosyalarınızda da aynı şekilde çalışır. Bu cümleyi seçip Vurgula’yı seçin.',
      tries: [
        'Kenar boşluğuna yazmak için M tuşuna basın ya da İşaretle’ye dokunun.',
        'Daha fazlası için sayfaya sağ tıklayın ya da basılı tutun.',
        'Sözcüklerin kendisini değiştirmek isterseniz onları seçip Metni düzenle’yi kullanın.',
      ],
      margin: 'NOTLAR',
    },
    form: {
      title: 'Bir form doldurun',
      intro:
        'Bir alana tıklayıp yazın. Alanlar PDF’in bir parçasıdır; yazdıklarınız dosyaya kaydedilir ve her PDF okuyucusunda görünür.',
      card: 'Ziyaretçi defteri',
      cardNote: 'Adınızı yazın, ardından imzalayın.',
      name: 'Ad Soyad',
      date: 'Tarih',
      tried: 'Recto’yu denedim.',
      signature: 'İmza',
      signHere: 'Doldur ve imzala ile buraya imza atın.',
    },
    scan: {
      alt: 'Taranmış mektup, metin katmanı yok',
      sender: ['Ada Lindqvist', 'Linden Row 4, Northam'],
      date: '6 Ekim 2026',
      salutation: 'Sayın okuyucu,',
      paragraphs: [
        'Bu sayfa bir resim: kısa bir mektubun taranmış hâli ve arkasında hiç metin yok. Bu sözcükleri henüz seçemez ya da aratamazsınız.',
        'Metni tanı, sayfayı aranabilir yapar. Resimdeki sözcükleri okur ve görünmeyen bir metin katmanı ekler; böylece onları seçebilir, arayabilir ve kopyalayabilirsiniz. Recto’daki her şey gibi bu da bu cihazda çalışır.',
      ],
      closing: 'Saygılarımla,',
      signer: 'Ada Lindqvist',
    },
    pages: {
      title: 'Sayfaları düzenleyin',
      grid: 'Tüm sayfaları görmek için 3’e basın ya da iki parmakla kıstırın. Bir küçük resmi sürükleyerek taşıyın.',
      alt: 'Bu örnek belgenin dört sayfasının küçük resimleri; üçüncüsü seçili',
      keptTitle: 'Önce saklanır, sonra kaydedilir',
      kept: 'Değişiklikleriniz bu cihazda saklanır. Kaydet, onları dosyaya yazar.',
      copy: 'Kopya kaydet yeni bir dosya yazar, bu dosyayı olduğu gibi bırakır.',
      end: 'Tur bu kadar. Hazır olduğunuzda kendi PDF’lerinizi açın.',
    },
  },
};

// ---------------------------------------------------------------------------
// Colours, fonts and styles
// ---------------------------------------------------------------------------

type Rgb = readonly [number, number, number];
/** Graphite ink and neutrals, with Recto's lime (#c8fb3d, ADR-0023) as the one accent. */
const INK: Rgb = [0.09, 0.098, 0.118];
const BODY: Rgb = [0.2, 0.216, 0.247];
const MUTED: Rgb = [0.42, 0.44, 0.48];
const RULE: Rgb = [0.84, 0.85, 0.87];
const PALE: Rgb = [0.955, 0.958, 0.965];
const WHITE: Rgb = [1, 1, 1];
const LIME: Rgb = [200 / 255, 251 / 255, 61 / 255];
/** The selection blue on the page (#4e61ed, ADR-0023), for the selected miniature. */
const SELECTION: Rgb = [78 / 255, 97 / 255, 237 / 255];

type FaceId = 'sans' | 'bold' | 'serif';
const FACES: Record<FaceId, { file: string; key: string; tag: string }> = {
  sans: { file: 'Inter-Regular.ttf', key: 'F1', tag: 'RSMPAA' },
  bold: { file: 'Inter-Bold.ttf', key: 'F2', tag: 'RSMPAB' },
  serif: { file: 'NotoSerif-Regular.ttf', key: 'F3', tag: 'RSMPAC' },
};

/**
 * Glyphs each subset gets up front: printable ASCII, the Turkish letters and the typography
 * the copy uses. Edit text then finds any ASCII or Turkish letter a person types in the
 * page's own font, and the glyph ids do not depend on which text comes first.
 */
const CHARSET = `${Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('')}çÇğĞıİöÖşŞüÜâÂ’‘“”–—…·×`;

interface Style {
  face: FaceId;
  size: number;
  color: Rgb;
  /** Character spacing (Tc) in points. */
  tracking?: number;
}

const STYLE = {
  kicker: { face: 'bold', size: 7.5, color: MUTED, tracking: 1.1 },
  folio: { face: 'sans', size: 7.5, color: MUTED },
  h1: { face: 'bold', size: 30, color: INK, tracking: -0.6 },
  h2: { face: 'bold', size: 13, color: INK, tracking: -0.1 },
  body: { face: 'serif', size: 12.5, color: BODY },
  lead: { face: 'serif', size: 13.5, color: BODY },
  ui: { face: 'sans', size: 11, color: INK },
  label: { face: 'bold', size: 7.5, color: MUTED, tracking: 0.9 },
  caption: { face: 'sans', size: 9, color: MUTED },
  number: { face: 'bold', size: 8.5, color: INK },
} satisfies Record<string, Style>;

interface FkGlyph {
  advanceWidth: number;
  codePoints: number[];
  path: { commands: PathCommand[] };
}
interface FkFont {
  unitsPerEm: number;
  postscriptName: string;
  layout(text: string): {
    glyphs: FkGlyph[];
    positions: { xAdvance: number; xOffset: number; yOffset: number }[];
  };
}
type Fontkit = Parameters<PDFDocument['registerFontkit']>[0];

/** @cantoo/fontkit, resolved from the engine package (as in demo-fixtures.ts). */
function loadFontkit(): Fontkit {
  const require = createRequire(join(REPO_ROOT, 'packages', 'engine', 'package.json'));
  return require('@cantoo/fontkit') as Fontkit;
}

function openFont(file: string): FkFont {
  const fontkit = loadFontkit() as unknown as { create(bytes: Uint8Array): FkFont };
  return fontkit.create(new Uint8Array(readFileSync(join(FONT_DIR, file))));
}

async function embedFaces(doc: PDFDocument): Promise<Record<FaceId, PDFFont>> {
  doc.registerFontkit(loadFontkit());
  const faces = {} as Record<FaceId, PDFFont>;
  for (const id of Object.keys(FACES) as FaceId[]) {
    const spec = FACES[id];
    const bytes = new Uint8Array(readFileSync(join(FONT_DIR, spec.file)));
    const font = await doc.embedFont(bytes, {
      subset: true,
      customName: `${spec.tag}+${openFont(spec.file).postscriptName}`,
      // Inter's contextual alternates swap "-" and brackets next to capitals; off, so the
      // preset covers every glyph the copy uses.
      features: { calt: false },
    });
    for (const ch of CHARSET) font.encodeText(ch);
    faces[id] = font;
  }
  return faces;
}

// ---------------------------------------------------------------------------
// Structure (tagged PDF): Document > H1 / H2 / P / Figure / Form, footers as artifacts
// ---------------------------------------------------------------------------

interface Elem {
  readonly type: string;
  readonly page: PDFPage;
  readonly kids: (number | PDFDict)[];
  readonly alt?: string;
  ref?: PDFRef;
}

class Structure {
  readonly elems: Elem[] = [];
  /** Per page (StructParents = index): the element each MCID belongs to. */
  private readonly marked = new Map<number, Elem[]>();
  /** Widget annotations (StructParent keys after the pages'). */
  private readonly objects: { elem: Elem; widget: PDFRef; page: PDFPage }[] = [];
  private readonly doc: PDFDocument;

  constructor(doc: PDFDocument) {
    this.doc = doc;
  }

  elem(type: string, page: PDFPage, alt?: string): Elem {
    const elem: Elem = { type, page, kids: [], ...(alt === undefined ? {} : { alt }) };
    this.elems.push(elem);
    return elem;
  }

  /** The next MCID on page `index` for `elem`. */
  mcid(index: number, elem: Elem): number {
    const list = this.marked.get(index) ?? [];
    list.push(elem);
    this.marked.set(index, list);
    const id = list.length - 1;
    elem.kids.push(id);
    return id;
  }

  /** A widget as the content of a Form element (ISO 32000-1 §14.8.4.5). */
  widget(elem: Elem, widget: PDFRef, page: PDFPage): void {
    this.objects.push({ elem, widget, page });
  }

  write(lang: string): void {
    const ctx = this.doc.context;
    const root = ctx.nextRef();
    const document = ctx.nextRef();
    for (const elem of this.elems) elem.ref = ctx.nextRef();
    const pages = this.doc.getPages();
    const nums: PDFObject[] = [];
    pages.forEach((page, index) => {
      page.node.set(PDFName.of('StructParents'), PDFNumber.of(index));
      nums.push(PDFNumber.of(index), ctx.obj((this.marked.get(index) ?? []).map((e) => e.ref)));
    });
    this.objects.forEach(({ elem, widget, page }, i) => {
      const key = pages.length + i;
      ctx.lookup(widget, PDFDict).set(PDFName.of('StructParent'), PDFNumber.of(key));
      elem.kids.push(ctx.obj({ Type: 'OBJR', Obj: widget, Pg: page.ref }));
      nums.push(PDFNumber.of(key), elem.ref as PDFRef);
    });
    for (const elem of this.elems) {
      const dict = ctx.obj({
        Type: 'StructElem',
        S: elem.type,
        P: document,
        Pg: elem.page.ref,
        K: elem.kids.length === 1 ? elem.kids[0] : elem.kids,
      });
      if (elem.alt !== undefined) dict.set(PDFName.of('Alt'), PDFHexString.fromText(elem.alt));
      ctx.assign(elem.ref as PDFRef, dict);
    }
    ctx.assign(
      document,
      ctx.obj({
        Type: 'StructElem',
        S: 'Document',
        P: root,
        Lang: PDFString.of(lang),
        K: this.elems.map((e) => e.ref),
      }),
    );
    ctx.assign(
      root,
      ctx.obj({
        Type: 'StructTreeRoot',
        K: document,
        ParentTree: ctx.register(ctx.obj({ Nums: nums })),
        ParentTreeNextKey: pages.length + this.objects.length,
      }),
    );
    this.doc.catalog.set(PDFName.of('StructTreeRoot'), root);
    this.doc.catalog.set(PDFName.of('MarkInfo'), ctx.obj({ Marked: true }));
  }
}

// ---------------------------------------------------------------------------
// Page writer: text and shapes with fixed font names, each run marked for the structure
// ---------------------------------------------------------------------------

/**
 * `BDC` with an inline property list. pdf-lib's operator arguments are typed without
 * dictionaries, but an operator writes each argument with its own `toString`, so a dict
 * serialises as `<< /MCID 0 >>` like any other.
 */
const bdc = (tag: string, props: PDFDict) =>
  PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [
    PDFName.of(tag),
    props as unknown as PDFName,
  ]);
const bmc = (tag: string) => PDFOperator.of(PDFOperatorNames.BeginMarkedContent, [PDFName.of(tag)]);
const emc = () => PDFOperator.of(PDFOperatorNames.EndMarkedContent);

class Writer {
  readonly page: PDFPage;
  private readonly index: number;
  private readonly doc: PDFDocument;
  private readonly faces: Record<FaceId, PDFFont>;
  private readonly tags: Structure;

  constructor(
    doc: PDFDocument,
    faces: Record<FaceId, PDFFont>,
    tags: Structure,
    page: PDFPage,
    index: number,
  ) {
    this.doc = doc;
    this.faces = faces;
    this.tags = tags;
    this.page = page;
    this.index = index;
    for (const id of Object.keys(FACES) as FaceId[])
      page.node.setFontDictionary(PDFName.of(FACES[id].key), faces[id].ref);
  }

  width(style: Style, value: string): number {
    const plain = this.faces[style.face].widthOfTextAtSize(value, style.size);
    return plain + (style.tracking ?? 0) * Math.max(0, Array.from(value).length - 1);
  }

  /** One line of text inside `elem` (or as an artifact when `elem` is null). */
  text(
    elem: Elem | null,
    style: Style,
    x: number,
    y: number,
    value: string,
    align: 'left' | 'right' = 'left',
  ): number {
    const width = this.width(style, value);
    const left = align === 'right' ? x - width : x;
    const open = elem
      ? bdc(elem.type, this.doc.context.obj({ MCID: this.tags.mcid(this.index, elem) }))
      : bdc('Artifact', this.doc.context.obj({ Type: 'Pagination' }));
    this.page.pushOperators(
      open,
      setFillingRgbColor(...style.color),
      beginText(),
      setFontAndSize(FACES[style.face].key, style.size),
      setCharacterSpacing(style.tracking ?? 0),
      setTextMatrix(1, 0, 0, 1, r2(left), r2(y)),
      showText(this.faces[style.face].encodeText(value)),
      endText(),
      emc(),
    );
    return width;
  }

  /** Greedy word wrap at `width`. */
  wrap(style: Style, value: string, width: number): string[] {
    const lines: string[] = [];
    let current = '';
    for (const word of value.split(' ')) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && this.width(style, candidate) > width) {
        lines.push(current);
        current = word;
      } else current = candidate;
    }
    if (current) lines.push(current);
    return lines;
  }

  /** A paragraph as one P element; returns the y below it. */
  paragraph(
    style: Style,
    x: number,
    y: number,
    width: number,
    leading: number,
    value: string,
    type = 'P',
  ): number {
    const elem = this.tags.elem(type, this.page);
    const lines = this.wrap(style, value, width);
    lines.forEach((line, i) => this.text(elem, style, x, y - i * leading, line));
    return y - lines.length * leading;
  }

  heading(type: 'H1' | 'H2', style: Style, x: number, y: number, value: string): void {
    this.text(this.tags.elem(type, this.page), style, x, y, value);
  }

  /** Decoration, marked as an artifact. */
  art(...ops: PDFOperator[]): void {
    this.page.pushOperators(
      bmc('Artifact'),
      pushGraphicsState(),
      ...ops,
      popGraphicsState(),
      emc(),
    );
  }

  /** Drawing that belongs to a Figure element (the miniatures). */
  figure(elem: Elem, ...ops: PDFOperator[]): void {
    this.page.pushOperators(
      bdc('Figure', this.doc.context.obj({ MCID: this.tags.mcid(this.index, elem) })),
      pushGraphicsState(),
      ...ops,
      popGraphicsState(),
      emc(),
    );
  }
}

function rect(x: number, y: number, w: number, h: number, color: Rgb): PDFOperator[] {
  return [setFillingRgbColor(...color), rectangle(r2(x), r2(y), r2(w), r2(h)), fill()];
}

/** A rounded rectangle path (κ = 0.5523 quarter circles). */
function roundedPath(x: number, y: number, w: number, h: number, radius: number): PDFOperator[] {
  const k = radius * 0.5523;
  const [x1, y1] = [x + w, y + h];
  return [
    moveTo(r2(x + radius), r2(y)),
    lineTo(r2(x1 - radius), r2(y)),
    appendBezierCurve(
      r2(x1 - radius + k),
      r2(y),
      r2(x1),
      r2(y + radius - k),
      r2(x1),
      r2(y + radius),
    ),
    lineTo(r2(x1), r2(y1 - radius)),
    appendBezierCurve(
      r2(x1),
      r2(y1 - radius + k),
      r2(x1 - radius + k),
      r2(y1),
      r2(x1 - radius),
      r2(y1),
    ),
    lineTo(r2(x + radius), r2(y1)),
    appendBezierCurve(
      r2(x + radius - k),
      r2(y1),
      r2(x),
      r2(y1 - radius + k),
      r2(x),
      r2(y1 - radius),
    ),
    lineTo(r2(x), r2(y + radius)),
    appendBezierCurve(r2(x), r2(y + radius - k), r2(x + radius - k), r2(y), r2(x + radius), r2(y)),
    closePath(),
  ];
}

function hairline(x0: number, y0: number, x1: number, y1: number, color: Rgb, width = 0.5) {
  return [
    setStrokingRgbColor(...color),
    setLineWidth(width),
    moveTo(r2(x0), r2(y0)),
    lineTo(r2(x1), r2(y1)),
    stroke(),
  ];
}

function circle(cx: number, cy: number, radius: number): PDFOperator[] {
  const k = radius * 0.5523;
  return [
    moveTo(r2(cx + radius), r2(cy)),
    appendBezierCurve(
      r2(cx + radius),
      r2(cy + k),
      r2(cx + k),
      r2(cy + radius),
      r2(cx),
      r2(cy + radius),
    ),
    appendBezierCurve(
      r2(cx - k),
      r2(cy + radius),
      r2(cx - radius),
      r2(cy + k),
      r2(cx - radius),
      r2(cy),
    ),
    appendBezierCurve(
      r2(cx - radius),
      r2(cy - k),
      r2(cx - k),
      r2(cy - radius),
      r2(cx),
      r2(cy - radius),
    ),
    appendBezierCurve(
      r2(cx + k),
      r2(cy - radius),
      r2(cx + radius),
      r2(cy - k),
      r2(cx + radius),
      r2(cy),
    ),
    closePath(),
  ];
}

// ---------------------------------------------------------------------------
// Page furniture: the kicker row, the H1 with its lime rule, the footer
// ---------------------------------------------------------------------------

const KICKER_Y = PAGE_H - 52;
const H1_Y = PAGE_H - 132;
const BODY_TOP = H1_Y - 52;

function furniture(w: Writer, copy: SampleCopy, n: number, section: string): void {
  w.art(...roundedPath(LEFT, KICKER_Y - 1, 7, 7, 1.6), setFillingRgbColor(...LIME), fill());
  w.text(null, STYLE.kicker, LEFT + 13, KICKER_Y, copy.kicker);
  w.text(null, STYLE.kicker, RIGHT, KICKER_Y, section.toLocaleUpperCase(copy.lang), 'right');
  w.art(...hairline(LEFT, 52, RIGHT, 52, RULE));
  w.text(null, STYLE.folio, LEFT, 38, copy.footer);
  w.text(null, STYLE.folio, RIGHT, 38, `${n} / ${SAMPLE_PAGE_COUNT}`, 'right');
}

function title(w: Writer, value: string): void {
  w.heading('H1', STYLE.h1, LEFT, H1_Y, value);
  w.art(...roundedPath(LEFT, H1_Y - 22, 28, 4, 2), setFillingRgbColor(...LIME), fill());
}

// ---------------------------------------------------------------------------
// Page 1: welcome
// ---------------------------------------------------------------------------

/** The text column takes 60 % of the measure; the rest is an empty margin to write in. */
const COLUMN_W = Math.round(CONTENT_W * 0.6);
const MARGIN_X = LEFT + COLUMN_W + 28;

function welcomePage(w: Writer, copy: SampleCopy): void {
  const c = copy.welcome;
  furniture(w, copy, 1, copy.outline[0]);
  title(w, c.title);
  let y = w.paragraph(STYLE.lead, LEFT, BODY_TOP, COLUMN_W, 22, c.paragraph);
  y -= 26;
  for (const [i, line] of c.tries.entries()) {
    w.art(...circle(LEFT + 8, y + 3.6, 8), setFillingRgbColor(...LIME), fill());
    const digit = String(i + 1);
    const dw = w.width(STYLE.number, digit);
    w.text(null, STYLE.number, LEFT + 8 - dw / 2, y + 0.6, digit);
    y = w.paragraph(STYLE.ui, LEFT + 28, y, COLUMN_W - 28, 16, line) - 14;
  }
  // The margin: a hairline, a label and faint dotted lines to write on.
  const top = BODY_TOP + 10;
  const bottom = 92;
  w.art(...hairline(MARGIN_X - 14, top, MARGIN_X - 14, bottom, RULE));
  w.text(null, STYLE.label, MARGIN_X, BODY_TOP, c.margin);
  for (let ly = BODY_TOP - 30; ly > bottom; ly -= 30)
    w.art(
      setDashPattern([0.1, 3.4], 0),
      setLineCap(1),
      ...hairline(MARGIN_X, ly, RIGHT, ly, RULE, 0.9),
    );
}

// ---------------------------------------------------------------------------
// Page 2: a form
// ---------------------------------------------------------------------------

const FIELD_BORDER = rgb(...RULE);

function formPage(w: Writer, copy: SampleCopy, doc: PDFDocument, tags: Structure): void {
  const c = copy.form;
  furniture(w, copy, 2, copy.outline[1]);
  title(w, c.title);
  const introBottom = w.paragraph(STYLE.lead, LEFT, BODY_TOP, CONTENT_W - 60, 22, c.intro);

  // The card.
  const cardTop = introBottom - 30;
  const cardH = 330;
  const cardY = cardTop - cardH;
  const pad = 28;
  w.art(...roundedPath(LEFT, cardY, CONTENT_W, cardH, 10), setFillingRgbColor(...PALE), fill());
  w.heading('H2', STYLE.h2, LEFT + pad, cardTop - pad - 6, c.card);
  w.paragraph(STYLE.caption, LEFT + pad, cardTop - pad - 24, CONTENT_W - 2 * pad, 12, c.cardNote);

  const form = doc.getForm();
  const inner = CONTENT_W - 2 * pad;
  const dateW = 132;
  const nameW = inner - dateW - 18;
  const rowTop = cardTop - pad - 66;
  const fieldH = 28;
  const textField = (field: string, label: string, x: number, width: number) => {
    w.text(null, STYLE.label, x, rowTop, label.toLocaleUpperCase(copy.lang));
    const tf = form.createTextField(field);
    tf.addToPage(w.page, {
      x: r2(x),
      y: r2(rowTop - 10 - fieldH),
      width: r2(width),
      height: fieldH,
      borderWidth: 1,
      borderColor: FIELD_BORDER,
      backgroundColor: rgb(...WHITE),
    });
    tf.setFontSize(12);
    tf.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(label));
    const widget = tf.acroField.getWidgets()[0];
    const ref = widget ? doc.context.getObjectRef(widget.dict) : undefined;
    if (ref) tags.widget(tags.elem('Form', w.page), ref, w.page);
  };
  textField('name', c.name, LEFT + pad, nameW);
  textField('date', c.date, LEFT + pad + nameW + 18, dateW);

  // The checkbox.
  const boxY = rowTop - 10 - fieldH - 40;
  const cb = form.createCheckBox('tried');
  cb.addToPage(w.page, {
    x: LEFT + pad,
    y: r2(boxY - 3),
    width: 15,
    height: 15,
    borderWidth: 1,
    borderColor: rgb(...MUTED),
    backgroundColor: rgb(...WHITE),
  });
  cb.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(c.tried));
  const cbWidget = cb.acroField.getWidgets()[0];
  const cbRef = cbWidget ? doc.context.getObjectRef(cbWidget.dict) : undefined;
  if (cbRef) tags.widget(tags.elem('Form', w.page), cbRef, w.page);
  w.paragraph(STYLE.ui, LEFT + pad + 25, boxY, inner - 25, 16, c.tried);

  // Where to sign: a drawn place, not a /Sig field, so Fill & sign places the signature here.
  const sigTop = boxY - 34;
  const sigW = 250;
  const sigH = 78;
  const sx = LEFT + pad;
  w.text(null, STYLE.label, sx, sigTop, c.signature.toLocaleUpperCase(copy.lang));
  const sy = sigTop - 10 - sigH;
  w.art(
    ...roundedPath(sx, sy, sigW, sigH, 4),
    setFillingRgbColor(...WHITE),
    fill(),
    setDashPattern([3, 2.5], 0),
    setStrokingRgbColor(...MUTED),
    setLineWidth(0.8),
    ...roundedPath(sx, sy, sigW, sigH, 4),
    stroke(),
  );
  w.art(...hairline(sx + 16, sy + 20, sx + sigW - 16, sy + 20, MUTED, 0.6));
  // The "×" that marks a signature line.
  w.art(
    setStrokingRgbColor(...MUTED),
    setLineWidth(0.9),
    setLineCap(1),
    moveTo(sx + 16, sy + 26),
    lineTo(sx + 22, sy + 32),
    moveTo(sx + 22, sy + 26),
    lineTo(sx + 16, sy + 32),
    stroke(),
  );
  w.paragraph(STYLE.ui, sx + sigW + 20, sy + sigH / 2 + 4, inner - sigW - 20, 16, c.signHere);
}

// ---------------------------------------------------------------------------
// Page 3: a scan (an image with no text layer)
// ---------------------------------------------------------------------------

const SCAN_DPI = 150;
const PX = SCAN_DPI / 72;
/** Paper on a scan is not pure white: an even light tone. */
const PAPER_TONE = 0.035;
const SKEW_DEGREES = 0.45;
const SPECKS = 160;

interface ScanLine {
  text: string;
  size: number;
  x: number;
  baseline: number;
  bold?: boolean;
  grey?: number;
}

function fkWidth(font: FkFont, size: number, text: string): number {
  const run = font.layout(text);
  return (
    run.glyphs.reduce((n, g, i) => n + (run.positions[i]?.xAdvance ?? g.advanceWidth), 0) *
    (size / font.unitsPerEm)
  );
}

function fkWrap(font: FkFont, size: number, text: string, width: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && fkWidth(font, size, candidate) > width) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines;
}

function letterLines(regular: FkFont, copy: SampleCopy): ScanLine[] {
  const s = copy.scan;
  const x = 86;
  const width = PAGE_W - 2 * x;
  const lines: ScanLine[] = [
    { text: s.sender[0] ?? '', size: 15, x, baseline: 752, bold: true },
    { text: s.sender[1] ?? '', size: 10, x, baseline: 736, grey: 0.7 },
    { text: s.date, size: 11.5, x, baseline: 680 },
    { text: s.salutation, size: 11.5, x, baseline: 640 },
  ];
  let y = 612;
  for (const paragraph of s.paragraphs) {
    for (const text of fkWrap(regular, 11.5, paragraph, width)) {
      lines.push({ text, size: 11.5, x, baseline: y });
      y -= 17;
    }
    y -= 10;
  }
  lines.push({ text: s.closing, size: 11.5, x, baseline: y - 6 });
  lines.push({ text: s.signer, size: 11.5, x, baseline: y - 62, bold: true });
  lines.push({ text: copy.footer, size: 7.5, x: LEFT, baseline: 38, grey: 0.75 });
  const folio = `${SAMPLE_SCAN_PAGE} / ${SAMPLE_PAGE_COUNT}`;
  lines.push({
    text: folio,
    size: 7.5,
    x: RIGHT - fkWidth(regular, 7.5, folio),
    baseline: 38,
    grey: 0.75,
  });
  return lines;
}

/** Rasterises the letter, slightly skewed, with a paper tone and a little dust. */
function scanLetter(
  copy: SampleCopy,
  seed: string,
): { grey: Uint8Array; width: number; height: number } {
  const regular = openFont('Inter-Regular.ttf');
  const bold = openFont('Inter-Bold.ttf');
  const width = Math.round(PAGE_W * PX);
  const height = Math.round(PAGE_H * PX);
  const canvas = new Canvas(width, height);
  const theta = (SKEW_DEGREES * Math.PI) / 180;
  const [cos, sin] = [Math.cos(theta), Math.sin(theta)];
  const [cx, cy] = [PAGE_W / 2, PAGE_H / 2];
  const place = (x: number, y: number): [number, number] => {
    const rx = cx + (x - cx) * cos - (y - cy) * sin;
    const ry = cy + (x - cx) * sin + (y - cy) * cos;
    return [rx * PX, (PAGE_H - ry) * PX];
  };
  for (const line of letterLines(regular, copy)) {
    const font = line.bold ? bold : regular;
    const scale = line.size / font.unitsPerEm;
    const run = font.layout(line.text);
    // A lighter grey prints as less ink.
    const ink = new Canvas(width, height);
    let pen = 0;
    for (const [i, glyph] of run.glyphs.entries()) {
      const pos = run.positions[i];
      const ox = line.x + (pen + (pos?.xOffset ?? 0)) * scale;
      const oy = line.baseline + (pos?.yOffset ?? 0) * scale;
      if (!glyph.codePoints.includes(32))
        (line.grey ? ink : canvas).fillPath(glyph.path.commands, (gx, gy) =>
          place(ox + gx * scale, oy + gy * scale),
        );
      pen += pos?.xAdvance ?? glyph.advanceWidth;
    }
    if (line.grey) {
      const amount = 1 - line.grey + 0.15;
      for (let i = 0; i < ink.coverage.length; i++) {
        const v = ink.coverage[i] ?? 0;
        if (v) canvas.coverage[i] = (canvas.coverage[i] ?? 0) + Math.min(1, v) * amount;
      }
    }
  }
  // A rule under the letterhead.
  const ruleY = 722;
  canvas.fillPolygons([
    [
      place(86, ruleY - 0.35),
      place(PAGE_W - 86, ruleY - 0.35),
      place(PAGE_W - 86, ruleY + 0.35),
      place(86, ruleY + 0.35),
    ],
  ]);
  const random = seededRandom(seed);
  for (let n = 0; n < SPECKS; n++) {
    const x = Math.floor(random() * width);
    const y = Math.floor(random() * height);
    const amount = 0.2 + random() * 0.4;
    const i = y * width + x;
    canvas.coverage[i] = (canvas.coverage[i] ?? 0) + amount;
  }
  for (let i = 0; i < canvas.coverage.length; i++)
    canvas.coverage[i] = (canvas.coverage[i] ?? 0) + PAPER_TONE;
  return { grey: canvas.toGrey(), width, height };
}

function scanPage(
  doc: PDFDocument,
  page: PDFPage,
  copy: SampleCopy,
  tags: Structure,
  index: number,
  file: string,
): void {
  const { grey, width, height } = scanLetter(copy, `${file}#scan`);
  const image = doc.context.register(
    doc.context.flateStream(grey, {
      Type: 'XObject',
      Subtype: 'Image',
      Width: width,
      Height: height,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
    }),
  );
  page.node.set(PDFName.of('Resources'), doc.context.obj({ XObject: { Im1: image } }));
  const figure = tags.elem('Figure', page, copy.scan.alt);
  const mcid = tags.mcid(index, figure);
  page.node.set(
    PDFName.of('Contents'),
    doc.context.register(
      doc.context.flateStream(
        `/Figure <</MCID ${mcid}>> BDC q ${r2(PAGE_W)} 0 0 ${r2(PAGE_H)} 0 0 cm /Im1 Do Q EMC`,
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Page 4: the pages, kept and saved
// ---------------------------------------------------------------------------

/** One miniature: a page with its content suggested by bars, at (x, y) bottom left. */
function miniature(n: number, x: number, y: number, w: number, h: number): PDFOperator[] {
  const s = w / PAGE_W;
  const bar = (bx: number, by: number, bw: number, bh: number, color: Rgb) =>
    rect(x + bx * s, y + by * s, bw * s, bh * s, color);
  const ops: PDFOperator[] = [
    // Shadow, then the sheet.
    ...rect(x + 1.2, y - 1.6, w, h, [0.88, 0.89, 0.9]),
    ...rect(x, y, w, h, WHITE),
    setStrokingRgbColor(...RULE),
    setLineWidth(0.5),
    rectangle(r2(x), r2(y), r2(w), r2(h)),
    stroke(),
    ...bar(LEFT, KICKER_Y, 60, 9, RULE),
  ];
  const textBars = (top: number, count: number, width: number, gap = 22) => {
    for (let i = 0; i < count; i++)
      ops.push(...bar(LEFT, top - i * gap, i === count - 1 ? width * 0.6 : width, 9, RULE));
  };
  if (n === 1) {
    ops.push(...bar(LEFT, H1_Y, 300, 24, [0.62, 0.64, 0.68]), ...bar(LEFT, H1_Y - 22, 28, 5, LIME));
    textBars(BODY_TOP, 7, COLUMN_W);
    textBars(BODY_TOP - 200, 3, COLUMN_W - 40, 34);
  } else if (n === 2) {
    ops.push(...bar(LEFT, H1_Y, 240, 24, [0.62, 0.64, 0.68]), ...bar(LEFT, H1_Y - 22, 28, 5, LIME));
    textBars(BODY_TOP, 2, CONTENT_W - 60);
    ops.push(...bar(LEFT, 250, CONTENT_W, 360, PALE));
    ops.push(...bar(LEFT + 28, 500, 280, 30, WHITE), ...bar(LEFT + 330, 500, 110, 30, WHITE));
    ops.push(...bar(LEFT + 28, 440, 16, 16, WHITE), ...bar(LEFT + 28, 300, 250, 80, WHITE));
  } else if (n === 3) {
    ops.push(...rect(x, y, w, h, [0.965, 0.965, 0.965]));
    ops.push(...bar(86, 752, 130, 12, [0.55, 0.55, 0.55]));
    for (let i = 0; i < 9; i++)
      ops.push(...bar(86, 612 - i * 20, i % 4 === 3 ? 260 : 420, 9, [0.72, 0.72, 0.72]));
  } else {
    ops.push(...bar(LEFT, H1_Y, 280, 24, [0.62, 0.64, 0.68]), ...bar(LEFT, H1_Y - 22, 28, 5, LIME));
    textBars(BODY_TOP, 2, CONTENT_W - 40);
    for (let i = 0; i < 4; i++) ops.push(...bar(LEFT + i * 118, 470, 92, 130, RULE));
    textBars(380, 4, CONTENT_W - 60);
  }
  return ops;
}

function pagesPage(w: Writer, copy: SampleCopy, tags: Structure): void {
  const c = copy.pages;
  furniture(w, copy, 4, copy.outline[3]);
  title(w, c.title);
  let y = w.paragraph(STYLE.lead, LEFT, BODY_TOP, CONTENT_W - 40, 22, c.grid);

  // Four miniatures across the measure, the third selected (as in the Pages grid).
  const gap = 26;
  const mw = (CONTENT_W - 3 * gap) / 4;
  const mh = mw * (PAGE_H / PAGE_W);
  const top = y - 34;
  const figure = tags.elem('Figure', w.page, c.alt);
  const ops: PDFOperator[] = [];
  for (let i = 0; i < 4; i++) {
    const x = LEFT + i * (mw + gap);
    const selected = i === 2;
    const lift = selected ? 6 : 0;
    ops.push(...miniature(i + 1, x, top - mh + lift, mw, mh));
    if (selected)
      ops.push(
        setStrokingRgbColor(...SELECTION),
        setLineWidth(2),
        ...roundedPath(x - 4, top - mh + lift - 4, mw + 8, mh + 8, 4),
        stroke(),
      );
  }
  w.figure(figure, ...ops);
  for (let i = 0; i < 4; i++) {
    const label = String(i + 1);
    const cx = LEFT + i * (mw + gap) + mw / 2;
    w.text(null, STYLE.caption, cx - w.width(STYLE.caption, label) / 2, top - mh - 22, label);
  }
  y = top - mh - 64;

  w.heading('H2', STYLE.h2, LEFT, y, c.keptTitle);
  y = w.paragraph(STYLE.body, LEFT, y - 26, CONTENT_W - 40, 20, c.kept);
  y = w.paragraph(STYLE.body, LEFT, y - 6, CONTENT_W - 40, 20, c.copy);
  w.art(...hairline(LEFT, y - 22, LEFT + 28, y - 22, RULE, 0.75));
  w.paragraph(STYLE.ui, LEFT, y - 50, CONTENT_W - 40, 16, c.end);
}

// ---------------------------------------------------------------------------
// Outline and the document
// ---------------------------------------------------------------------------

function writeOutline(doc: PDFDocument, titles: readonly string[]): void {
  const ctx = doc.context;
  const root = ctx.nextRef();
  const refs = titles.map(() => ctx.nextRef());
  const pages = doc.getPages();
  titles.forEach((value, i) => {
    const page = pages[i];
    const ref = refs[i];
    if (!page || !ref) throw new Error(`outline: no page ${i + 1}`);
    const dict = ctx.obj({
      Title: PDFHexString.fromText(value),
      Parent: root,
      Dest: [page.ref, PDFName.of('XYZ'), null, r2(PAGE_H), null],
    });
    const prev = refs[i - 1];
    const next = refs[i + 1];
    if (prev) dict.set(PDFName.of('Prev'), prev);
    if (next) dict.set(PDFName.of('Next'), next);
    ctx.assign(ref, dict);
  });
  ctx.assign(
    root,
    ctx.obj({
      Type: 'Outlines',
      First: refs[0],
      Last: refs[refs.length - 1],
      Count: titles.length,
    }),
  );
  doc.catalog.set(PDFName.of('Outlines'), root);
}

/** Builds one sample. Deterministic: the same locale gives the same bytes. */
export async function buildSample(locale: SampleLocale): Promise<Uint8Array> {
  const file = sampleFile(locale);
  return withDeterministicRandom(file, async () => {
    const copy = COPY[locale];
    const doc = await newDoc(copy.title);
    doc.setCreator(CREATOR);
    doc.setAuthor('Recto');
    doc.setSubject(copy.subject);
    doc.setLanguage(copy.lang);
    doc.catalog.set(PDFName.of('ViewerPreferences'), doc.context.obj({ DisplayDocTitle: true }));
    doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
    const faces = await embedFaces(doc);
    const tags = new Structure(doc);
    const pages = Array.from({ length: SAMPLE_PAGE_COUNT }, () => doc.addPage(A4));
    const writer = (index: number) => {
      const page = pages[index];
      if (!page) throw new Error(`no page ${index + 1}`);
      return new Writer(doc, faces, tags, page, index);
    };
    welcomePage(writer(0), copy);
    formPage(writer(1), copy, doc, tags);
    const scan = pages[SAMPLE_SCAN_PAGE - 1];
    if (!scan) throw new Error('no scan page');
    scanPage(doc, scan, copy, tags, SAMPLE_SCAN_PAGE - 1, file);
    pagesPage(writer(3), copy, tags);
    writeOutline(doc, copy.outline);
    tags.write(copy.lang);
    return save(doc, file);
  });
}

/** Both samples, by file name. */
export async function buildSamples(): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  for (const locale of SAMPLE_LOCALES) out.set(sampleFile(locale), await buildSample(locale));
  return out;
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const built = await buildSamples();
  for (const [file, bytes] of built)
    if (bytes.length > SAMPLE_MAX_BYTES)
      throw new Error(`${file} is ${bytes.length} bytes, over the ${SAMPLE_MAX_BYTES}-byte cap`);
  if (check) {
    const stale = [...built].filter(([file, bytes]) => {
      const path = join(SAMPLE_DIR, file);
      return !existsSync(path) || sha256(readFileSync(path)) !== sha256(bytes);
    });
    if (stale.length) {
      console.error(`Not reproducible / out of date: ${stale.map(([f]) => f).join(', ')}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Both samples are byte-identical to ${SAMPLE_DIR}.`);
    return;
  }
  mkdirSync(SAMPLE_DIR, { recursive: true });
  for (const [file, bytes] of built) {
    writeFileSync(join(SAMPLE_DIR, file), bytes);
    console.log(
      `${file.padEnd(24)} ${String(bytes.length).padStart(8)} B  ${sha256(bytes).slice(0, 12)}`,
    );
  }
}

// Run as a script (`node sample-fixture.ts`); importing it (the unit test) builds nothing.
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
