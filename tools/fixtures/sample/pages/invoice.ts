/**
 * Page 7 of the full cut, the printer's invoice (design.md §4 page 7): redaction with Find
 * sensitive data. The payment box holds what the finder (apps/web/src/redaction/patterns.ts)
 * detects and validates: an IBAN (the registry's published example, mod-97 valid), an e-mail
 * on the reserved `.example` domain, a phone number from a range kept for drama (EN) or one no
 * subscriber can hold (TR), and the invoice's date. Everything is invented (R-16).
 */
import {
  lineTo,
  moveTo,
  rectangle,
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
  PALE,
  PT,
  RIGHT,
  RULE,
  STYLE,
  type Style,
  type Rgb,
  hairline,
  rect,
  roundRect,
} from '../kit.ts';
import { circlePath } from '../kit.ts';

/** A printer's registration target: a ring and a cross through it, one ink. */
function registration(cx: number, cy: number, r: number, color: Rgb, width: number) {
  return [
    setStrokingRgbColor(...color),
    setLineWidth(width),
    ...circlePath(cx, cy, r * 0.62),
    moveTo(cx - r, cy),
    lineTo(cx + r, cy),
    moveTo(cx, cy - r),
    lineTo(cx, cy + r),
    stroke(),
  ];
}

function strokeRect(x: number, y: number, ww: number, hh: number, color: Rgb, width: number) {
  return [setStrokingRgbColor(...color), setLineWidth(width), rectangle(x, y, ww, hh), stroke()];
}

const ROW = 24;

export function invoicePage(ctx: PageCtx): void {
  const { w, copy } = ctx;
  const c = copy.invoice;
  const up = (v: string) => v.toLocaleUpperCase(copy.lang);
  furniture(ctx, c.section);

  // The printer's letterhead (direction-v2.md §8 page 7): a printer's own mark, the registration
  // target, in one ink; the name on the scale's 19; the address in the caption size.
  w.art(...registration(LEFT + 13, 742, 12, INK, 0.9));
  w.text(w.elem('H1'), { face: 'bold', size: PT.display, color: INK }, LEFT + 36, 742, c.printer);
  w.text(
    w.elem('P'),
    { face: 'sans', size: PT.small, color: MUTED },
    LEFT + 36,
    729,
    c.printerLine,
  );
  w.text(null, STYLE.label, RIGHT, 756, up(copy.lang === 'tr' ? 'Fatura' : 'Invoice'), 'right');
  w.text(
    w.elem('P'),
    { face: 'bold', size: PT.title, color: INK },
    RIGHT,
    739,
    c.number.replace(/^\D+/, ''),
    'right',
  );
  w.text(w.elem('P'), { face: 'sans', size: PT.body, color: MUTED }, RIGHT, 726, c.date, 'right');
  w.art(
    ...hairline(LEFT, 706, RIGHT, 706, INK, 1),
    ...hairline(LEFT, 703.5, RIGHT, 703.5, INK, 0.35),
  );

  // Bill to.
  w.text(null, STYLE.label, LEFT, 680, up(c.billTo));
  w.text(w.elem('P'), { face: 'sans', size: PT.large, color: INK }, LEFT, 665, c.billName);

  // The table.
  const table = w.elem('Table');
  const cell: Style = { face: 'sans', size: PT.body, color: INK };
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
    const style: Style = last ? { face: 'bold', size: PT.title, color: INK } : cell;
    if (last) {
      y -= 8;
      w.art(...hairline(labelX, y + 18, RIGHT, y + 18, INK, 1));
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
  w.text(
    w.elem('H2'),
    { face: 'bold', size: PT.large, color: INK },
    LEFT + 20,
    boxTop - 26,
    c.payTitle,
  );
  const pay = w.elem('Table');
  for (let i = 0; i < c.pay.length; i += 2) {
    const tr = w.elem('TR', pay);
    for (const [k, [label, value]] of c.pay.slice(i, i + 2).entries()) {
      const cx = LEFT + 20 + k * (MEASURE / 2);
      const cy = boxTop - 52 - (i / 2) * cellH;
      const td = w.elem('TD', tr);
      w.text(td, STYLE.label, cx, cy, up(label));
      w.text(td, { face: 'sans', size: PT.large, color: INK }, cx, cy - 15, value);
    }
  }
  w.text(
    w.elem('P'),
    { face: 'sans', size: PT.body, color: MUTED },
    LEFT,
    boxTop - boxH - 24,
    c.terms,
  );

  // The printer's control strip: a step wedge from paper to solid, between two registration
  // targets, as printed in the trim of every proof (artifact; direction-v2.md §8 page 7).
  const stripY = 156;
  const steps = 11;
  const pw = 15;
  const sx = RIGHT - steps * pw;
  for (let i = 0; i < steps; i++) {
    const v = 1 - i / (steps - 1);
    const g = 0.09 + 0.91 * v;
    w.art(...rect(sx + i * pw, stripY, pw, 9, [g * 0.985, g * 0.99, g]));
  }
  w.art(...strokeRect(sx, stripY, steps * pw, 9, INK, 0.35));
  w.art(...registration(sx - 12, stripY + 4.5, 4.5, INK, 0.4));
  w.text(
    null,
    STYLE.label,
    LEFT,
    stripY + 2,
    up(copy.lang === 'tr' ? 'Kontrol şeridi · prova 2' : 'Control strip · proof 2'),
  );

  // The printer's foot line, as on their stationery: a rule across the measure, a thank-you and
  // what they keep, so the page ends where a real invoice does.
  const footY = 124;
  w.art(...hairline(LEFT, footY + 16, RIGHT, footY + 16, RULE));
  w.text(w.elem('P'), { face: 'bold', size: PT.small, color: INK }, LEFT, footY, c.printer);
  w.text(
    w.elem('P'),
    { face: 'sans', size: PT.small, color: MUTED },
    RIGHT,
    footY,
    c.thanks,
    'right',
  );

  trySlip(ctx, c.tryLine);
}
