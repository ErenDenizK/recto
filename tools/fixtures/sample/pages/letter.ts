/**
 * Page 2, the editor's letter and contents (design.md §4 page 2): reading acts (select,
 * highlight, Find, the pen). The letter runs ragged in a 330 pt column; the right-hand margin
 * is literally a margin, ruled for notes, with one sticky note already in it (the Review
 * panel and the phone's note layer have something from the start). Under it the contents,
 * each row a link to its page, and the editor's folder (full cut) or a line saying where the
 * other pages are (phone cut).
 */
import { setDashPattern, setLineCap } from '@cantoo/pdf-lib';
import { type PageCtx, SLIP_TOP, furniture, kicker, link, note, trySlip } from '../context.ts';
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
  PT,
  RIGHT,
  RULE,
  STYLE,
  type Style,
  hairline,
  rich,
} from '../kit.ts';
import { FRAME_TIME } from '../light.ts';
import { goTo } from './cover.ts';

const TEXT_W = 330;
const MARGIN_X = LEFT + TEXT_W + 26;
const LETTER = STYLE.letter;
const LETTER_LEADING = 16.5;
/** Contents row pitch: at least 46 (R-14's 30 pt target and its dek), at most 56. */
const ROW_MIN = 46;
const ROW_MAX = 56;

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
      pretty: true,
    });
    y = set.next - 9;
  }
  const sign: Style = { face: 'sans', size: PT.body, color: MUTED };
  const signBold: Style = { face: 'bold', size: PT.body, color: INK };
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
  // The rows share out the room down to the slip, so the page ends on the contents, not on
  // white (the letter is ragged and its length differs by language).
  const rows = (list: readonly ContentsRow[]) =>
    list.filter((row) => ctx.pageOf(row.page) !== undefined);
  const contents = rows(c.contents);
  const folderRows = ctx.edition === 'full' ? rows(c.folder) : [];
  const count = Math.max(contents.length, folderRows.length);
  const room = top - 34 - 23 - (SLIP_TOP + 36);
  const pitch = Math.max(ROW_MIN, Math.min(ROW_MAX, Math.floor(room / Math.max(1, count - 1))));
  const toc = w.elem('TOC');
  w.text(w.elem('H2', toc), STYLE.h2, LEFT, top, c.contentsTitle);
  contents.forEach((row, i) => contentsRow(ctx, toc, LEFT, top - 34 - i * pitch, row, pitch));

  if (ctx.edition === 'full') {
    const folder = w.elem('TOC');
    w.text(w.elem('H2', folder), STYLE.h2, COL2, top, c.folderTitle);
    folderRows.forEach((row, i) =>
      contentsRow(ctx, folder, COL2, top - 34 - i * pitch, row, pitch),
    );
  } else {
    w.text(w.elem('H2'), STYLE.h2, COL2, top, c.folderTitle);
    w.paragraph([{ text: c.folderPhone, style: { face: 'sans', size: PT.large, color: MUTED } }], {
      x: COL2,
      y: top - 34,
      width: COL_W,
      leading: 16,
      pretty: true,
    });
  }

  trySlip(ctx, cut(c.tryLine, ctx.edition));
}

/** One contents row: the page number, the title and its dek; the whole row links to the page. */
function contentsRow(
  ctx: PageCtx,
  parent: Elem,
  x: number,
  y: number,
  row: ContentsRow,
  pitch: number,
): void {
  const { w } = ctx;
  const n = ctx.pageOf(row.page);
  if (n === undefined) return;
  const item = w.elem('TOCI', parent);
  w.text(
    w.elem('Lbl', item),
    { face: 'bold', size: PT.title, color: LIME_800 },
    x,
    y - 7,
    String(n),
  );
  w.text(item, { face: 'bold', size: PT.large, color: INK }, x + 30, y, row.title);
  w.text(item, { face: 'sans', size: PT.small, color: MUTED }, x + 30, y - 13, row.dek);
  // The page's hour of the night, right-aligned: the contents read as the night's schedule
  // (MOB-14; direction-v2.md §8 page 2). An artifact, so the row's text stays its title.
  const hour = FRAME_TIME[ctx.ids[n - 1] ?? ''];
  if (hour)
    w.text(null, { face: 'sans', size: PT.small, color: MUTED }, x + COL_W, y + 1, hour, 'right');
  w.art(...hairline(x, y - 23, x + COL_W, y - 23, RULE, 0.5));
  link(ctx, [x, y - 23, x + COL_W, y + pitch - 23], row.page, goTo(ctx.copy, n, row.title), item);
}
