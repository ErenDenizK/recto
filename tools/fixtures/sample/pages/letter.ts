/**
 * Page 2, the editor's letter and contents (design.md §4 page 2): reading acts (select,
 * highlight, Find, the pen). The letter runs ragged in a 330 pt column; the right-hand margin
 * is literally a margin, ruled for notes, with one sticky note already in it (the Review
 * panel and the phone's note layer have something from the start). Under it the contents,
 * each row a link to its page, and the editor's folder (full cut) or a line saying where the
 * other pages are (phone cut).
 */
import { setDashPattern, setLineCap } from '@cantoo/pdf-lib';
import { type PageCtx, furniture, kicker, link, note, trySlip } from '../context.ts';
import { type ContentsRow, cut } from '../copy.ts';
import {
  COL2,
  COL_W,
  type Elem,
  INK,
  LEFT,
  LIME_800,
  MEASURE,
  MUTED,
  RIGHT,
  RULE,
  STYLE,
  type Style,
  hairline,
  rich,
} from '../kit.ts';
import { goTo } from './cover.ts';

const TEXT_W = 330;
const MARGIN_X = LEFT + TEXT_W + 26;
const LETTER: Style = { face: 'serif', size: 12, color: STYLE.letter.color };
const LETTER_LEADING = 17.5;
const ROW = 46;

export function letterPage(ctx: PageCtx): void {
  const { w, copy } = ctx;
  const c = copy.letter;
  furniture(ctx, c.section);
  kicker(ctx, 764, c.kicker);
  w.text(w.elem('H1'), STYLE.h1, LEFT, 728, c.title);

  // The letter.
  const first = 686;
  let y = first;
  for (const text of c.paragraphs) {
    const set = w.paragraph([{ text, style: LETTER }], {
      x: LEFT,
      y,
      width: TEXT_W,
      leading: LETTER_LEADING,
    });
    y = set.next - 9;
  }
  const sign: Style = { face: 'sans', size: 9.5, color: MUTED };
  const signBold: Style = { face: 'bold', size: 9.5, color: INK };
  const signY = y - 8;
  w.paragraph(rich(c.signoff, sign, signBold), { x: LEFT, y: signY, width: TEXT_W, leading: 12 });

  // The margin: a label and dotted rules to write on, beside the letter.
  const margin = w.elem('Div');
  w.text(
    w.elem('P', margin),
    STYLE.label,
    MARGIN_X,
    first,
    c.marginLabel.toLocaleUpperCase(copy.lang),
  );
  w.art(...hairline(MARGIN_X - 13, first + 10, MARGIN_X - 13, signY - 4, RULE));
  for (let ly = first - 22; ly >= signY - 2; ly -= 20)
    w.art(
      setDashPattern([0.1, 3], 0),
      setLineCap(1),
      ...hairline(MARGIN_X, ly, RIGHT, ly, RULE, 0.9),
    );
  note(ctx, RIGHT - 20, first - 8, c.note.author, c.note.text, margin);

  // Contents and the folder, side by side.
  const top = signY - 66;
  w.art(...hairline(LEFT, top + 28, LEFT + MEASURE, top + 28, INK, 0.75));
  const toc = w.elem('TOC');
  w.text(w.elem('H2', toc), STYLE.h2, LEFT, top, c.contentsTitle);
  c.contents.forEach((row, i) => contentsRow(ctx, toc, LEFT, top - 34 - i * ROW, row));

  if (ctx.edition === 'full') {
    const folder = w.elem('TOC');
    w.text(w.elem('H2', folder), STYLE.h2, COL2, top, c.folderTitle);
    c.folder.forEach((row, i) => contentsRow(ctx, folder, COL2, top - 34 - i * ROW, row));
  } else {
    w.text(w.elem('H2'), STYLE.h2, COL2, top, c.folderTitle);
    w.paragraph([{ text: c.folderPhone, style: { face: 'sans', size: 10.5, color: MUTED } }], {
      x: COL2,
      y: top - 34,
      width: COL_W,
      leading: 15,
    });
  }

  trySlip(ctx, cut(c.tryLine, ctx.edition));
}

/** One contents row: the page number, the title and its dek; the whole row links to the page. */
function contentsRow(ctx: PageCtx, parent: Elem, x: number, y: number, row: ContentsRow): void {
  const { w } = ctx;
  const n = ctx.pageOf(row.page);
  if (n === undefined) return;
  const item = w.elem('TOCI', parent);
  w.text(w.elem('Lbl', item), { face: 'bold', size: 17, color: LIME_800 }, x, y - 7, String(n));
  w.text(item, { face: 'bold', size: 10.5, color: INK }, x + 30, y, row.title);
  w.text(item, { face: 'sans', size: 8.5, color: MUTED }, x + 30, y - 13, row.dek);
  w.art(...hairline(x, y - 23, x + COL_W, y - 23, RULE, 0.5));
  link(ctx, [x, y - 23, x + COL_W, y + ROW - 23], row.page, goTo(ctx.copy, n, row.title), item);
}
