/**
 * Page 7 of the full cut, the printer's invoice (design.md §4 page 7): redaction with Find
 * sensitive data. The payment box holds what the finder (apps/web/src/redaction/patterns.ts)
 * detects and validates: an IBAN (the registry's published example, mod-97 valid), an e-mail
 * on the reserved `.example` domain, a phone number from a range kept for drama (EN) or one no
 * subscriber can hold (TR), and the invoice's date. Everything is invented (R-16).
 */
import {
  appendBezierCurve,
  moveTo,
  setLineCap,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
} from '@cantoo/pdf-lib';
import { type PageCtx, furniture, trySlip } from '../context.ts';
import {
  INK,
  LEFT,
  MEASURE,
  MUTED,
  N8,
  PALE,
  RIGHT,
  RULE,
  STYLE,
  type Style,
  WHITE,
  disc,
  hairline,
  roundRect,
} from '../kit.ts';

const ROW = 24;

export function invoicePage(ctx: PageCtx): void {
  const { w, copy } = ctx;
  const c = copy.invoice;
  const up = (v: string) => v.toLocaleUpperCase(copy.lang);
  furniture(ctx, c.section);

  // The printer's letterhead: a small mark (a wave in a circle), the name, the address.
  w.art(...disc(LEFT + 15, 739, 15, N8));
  w.art(
    setStrokingRgbColor(...WHITE),
    setLineWidth(1.6),
    setLineCap(1),
    moveTo(LEFT + 5, 737),
    appendBezierCurve(LEFT + 9, 745, LEFT + 13, 745, LEFT + 15, 739),
    appendBezierCurve(LEFT + 17, 733, LEFT + 21, 733, LEFT + 25, 741),
    stroke(),
  );
  w.text(w.elem('H1'), { face: 'bold', size: 18, color: INK }, LEFT + 42, 740, c.printer);
  w.text(w.elem('P'), { face: 'sans', size: 8.5, color: MUTED }, LEFT + 42, 726, c.printerLine);
  w.text(w.elem('P'), { face: 'bold', size: 13, color: INK }, RIGHT, 740, c.number, 'right');
  w.text(w.elem('P'), { face: 'sans', size: 9.5, color: MUTED }, RIGHT, 725, c.date, 'right');

  // Bill to.
  w.text(null, STYLE.label, LEFT, 680, up(c.billTo));
  w.text(w.elem('P'), { face: 'sans', size: 10.5, color: INK }, LEFT, 665, c.billName);

  // The table.
  const table = w.elem('Table');
  const cell: Style = { face: 'sans', size: 9.5, color: INK };
  let y = 618;
  const head = w.elem('TR', table);
  w.text(w.elem('TH', head), STYLE.label, LEFT, y, up(c.description));
  w.text(w.elem('TH', head), STYLE.label, RIGHT, y, up(c.amount), 'right');
  w.art(...hairline(LEFT, y - 8, RIGHT, y - 8, INK, 0.75));
  y -= 8 + 17;
  for (const [text, amount] of c.rows) {
    const tr = w.elem('TR', table);
    w.text(w.elem('TD', tr), cell, LEFT, y, text);
    w.text(w.elem('TD', tr), cell, RIGHT, y, amount, 'right');
    w.art(...hairline(LEFT, y - 9, RIGHT, y - 9, RULE));
    y -= ROW;
  }
  // Totals, right-aligned under the amounts.
  y -= 6;
  const labelX = RIGHT - 180;
  c.totals.forEach(([text, amount], i) => {
    const last = i === c.totals.length - 1;
    const style: Style = last ? { face: 'bold', size: 12, color: INK } : cell;
    if (last) {
      y -= 4;
      w.art(...hairline(labelX, y + 14, RIGHT, y + 14, INK, 0.75));
    }
    const tr = w.elem('TR', table);
    w.text(w.elem('TD', tr), last ? style : { ...cell, color: MUTED }, labelX, y, text);
    w.text(w.elem('TD', tr), style, RIGHT, y, amount, 'right');
    y -= ROW - 4;
  });

  // The payment details: two columns of label-over-value cells. Each value sits on its own
  // line, never beside its label: the page's text then reads "IBAN\nGB82 …", and the finder's
  // patterns, which want a boundary before an IBAN or a phone number, see it.
  const boxTop = y - 22;
  const cellH = 40;
  const boxH = 52 + Math.ceil(c.pay.length / 2) * cellH;
  w.art(...roundRect(LEFT, boxTop - boxH, MEASURE, boxH, 8, PALE));
  w.text(w.elem('H2'), { face: 'bold', size: 11, color: INK }, LEFT + 20, boxTop - 26, c.payTitle);
  const pay = w.elem('Table');
  for (let i = 0; i < c.pay.length; i += 2) {
    const tr = w.elem('TR', pay);
    for (const [k, [label, value]] of c.pay.slice(i, i + 2).entries()) {
      const cx = LEFT + 20 + k * (MEASURE / 2);
      const cy = boxTop - 52 - (i / 2) * cellH;
      const td = w.elem('TD', tr);
      w.text(td, STYLE.label, cx, cy, up(label));
      w.text(td, { face: 'sans', size: 10.5, color: INK }, cx, cy - 15, value);
    }
  }
  w.text(w.elem('P'), { face: 'sans', size: 9, color: MUTED }, LEFT, boxTop - boxH - 24, c.terms);

  // The printer's foot line, as on their stationery: a rule across the measure, a thank-you and
  // what they keep, so the page ends where a real invoice does.
  const footY = 124;
  w.art(...hairline(LEFT, footY + 16, RIGHT, footY + 16, RULE));
  w.text(w.elem('P'), { face: 'bold', size: 8.5, color: INK }, LEFT, footY, c.printer);
  w.text(w.elem('P'), { face: 'sans', size: 8.5, color: MUTED }, RIGHT, footY, c.thanks, 'right');

  trySlip(ctx, c.tryLine);
}
