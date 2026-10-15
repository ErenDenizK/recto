/**
 * Page 5, the contributor agreement (design.md §4 page 5): forms fill on both editions, by a
 * tap with the fill bar on a phone (MOB-1) and by click and Tab on desktop and tablet; then the
 * person signs with the Sign tool on a drawn line (no /Sig field, design R-17).
 *
 * Fields sit on a 72 pt row pitch (47 px at a 390 px phone's fit width, so neighbours never
 * overlap even before MOB-1's nearest-field rule), text fields are 26 pt tall with a fixed 11 pt
 * DA (fieldZoom lands at 16 px) and at most 250 pt wide (they fit a phone after the zoom). The
 * two radios of one group are 32 pt apart. Every field has a /TU and a tagged Form element.
 */
import {
  PDFDict,
  type PDFDocument,
  PDFHexString,
  PDFName,
  PDFRef,
  type PDFWidgetAnnotation,
  rgb,
  setLineCap,
  setLineWidth,
  setStrokingRgbColor,
  lineTo,
  moveTo,
  stroke,
} from '@cantoo/pdf-lib';
import { type PageCtx, furniture, kicker, trySlip } from '../context.ts';
import { cut } from '../copy.ts';
import {
  BODY,
  INK,
  LEFT,
  MEASURE,
  MUTED,
  PALE,
  RULE,
  STYLE,
  type Style,
  WHITE,
  hairline,
  r2,
  roundRect,
} from '../kit.ts';

/** The form's fields in tab order (the manifest's `fields`). */
export const AGREEMENT_FIELDS = ['name', 'date', 'email', 'fee', 'agree'] as const;

const PITCH = 72;
const FIELD_H = 26;
const PAD = 22;

export function agreementPage(ctx: PageCtx): void {
  const { w, copy, doc } = ctx;
  const c = copy.agreement;
  const up = (v: string) => v.toLocaleUpperCase(copy.lang);
  furniture(ctx, c.section);
  kicker(ctx, 764, c.sub);
  w.text(w.elem('H1'), STYLE.h1, LEFT, 728, c.title);

  let y = 696;
  const terms: Style = { face: 'serif', size: 10.5, color: BODY };
  for (const text of c.terms)
    y = w.paragraph([{ text, style: terms }], { x: LEFT, y, width: 420, leading: 15 }).next - 6;

  // The card.
  const cardTop = y - 14;
  const cardBottom = 112;
  w.art(...roundRect(LEFT, cardBottom, MEASURE, cardTop - cardBottom, 10, PALE));
  const form = doc.getForm();
  const x0 = LEFT + PAD;
  w.text(w.elem('H2'), { face: 'bold', size: 13, color: INK }, x0, cardTop - PAD - 10, c.cardTitle);

  const label = (x: number, ly: number, value: string) =>
    w.text(null, STYLE.label, x, ly, up(value));
  const tag = (widget: PDFWidgetAnnotation | undefined) => {
    const ref = widget ? doc.context.getObjectRef(widget.dict) : undefined;
    if (ref instanceof PDFRef) w.tags.annot(w.elem('Form'), ref, w.page);
  };
  const textField = (name: string, title: string, x: number, top: number, width: number) => {
    label(x, top, title);
    const tf = form.createTextField(name);
    tf.addToPage(w.page, {
      x: r2(x),
      y: r2(top - 8 - FIELD_H),
      width: r2(width),
      height: FIELD_H,
      borderWidth: 1,
      borderColor: rgb(...RULE),
      backgroundColor: rgb(...WHITE),
    });
    tf.setFontSize(11);
    tf.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(title));
    tag(tf.acroField.getWidgets()[0]);
  };

  // Row 1: name and date; row 2: email.
  let row = cardTop - PAD - 44;
  textField('name', c.name, x0, row, 250);
  textField('date', c.date, x0 + 270, row, 150);
  row -= PITCH;
  textField('email', c.email, x0, row, 250);

  // Row 3: the fee, one radio group with two options 32 pt apart.
  row -= PITCH;
  label(x0, row, c.feeLabel);
  const fee = form.createRadioGroup('fee');
  fee.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(c.feeLabel));
  const option = (value: string, text: string, oy: number) => {
    fee.addOptionToPage(value, w.page, {
      x: x0,
      y: r2(oy - 3),
      width: 14,
      height: 14,
      borderWidth: 1,
      borderColor: rgb(...MUTED),
      backgroundColor: rgb(...WHITE),
    });
    w.text(w.elem('P'), STYLE.ui, x0 + 24, oy + 0.5, text);
  };
  option('transfer', c.feeTransfer, row - 26);
  option('trust', c.feeTrust, row - 26 - 32);
  for (const widget of fee.acroField.getWidgets()) tag(widget);
  dropDownAppearances(doc, fee.acroField.getWidgets());

  // Row 4: agree.
  row -= PITCH + 32;
  const agree = form.createCheckBox('agree');
  agree.addToPage(w.page, {
    x: x0,
    y: r2(row - 26 - 3),
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: rgb(...MUTED),
    backgroundColor: rgb(...WHITE),
  });
  agree.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(c.agree));
  tag(agree.acroField.getWidgets()[0]);
  dropDownAppearances(doc, agree.acroField.getWidgets());
  w.text(null, STYLE.ui, x0 + 24, row - 26 + 0.5, c.agree);

  // Row 5: where to sign, a drawn line (the Sign tool places the signature on it).
  row -= PITCH - 6;
  label(x0, row, c.signature);
  const lineY = row - 46;
  w.art(...hairline(x0, lineY, x0 + 250, lineY, INK, 0.75));
  w.art(
    setStrokingRgbColor(...MUTED),
    setLineWidth(0.9),
    setLineCap(1),
    moveTo(x0 + 2, lineY + 5),
    lineTo(x0 + 8, lineY + 11),
    moveTo(x0 + 8, lineY + 5),
    lineTo(x0 + 2, lineY + 11),
    stroke(),
  );
  if (lineY < cardBottom + 16) throw new Error(`agreement: the card overflows (${r2(lineY)})`);

  trySlip(ctx, cut(c.tryLine, ctx.edition));
}

/**
 * Checkboxes and radios need only their normal appearances (on and off); the pressed (/D) ones
 * pdf-lib adds are dropped, which keeps the four sample files inside the precache budget.
 */
function dropDownAppearances(doc: PDFDocument, widgets: readonly PDFWidgetAnnotation[]): void {
  for (const widget of widgets) {
    const ap = widget.dict.lookup(PDFName.of('AP'), PDFDict);
    const down = ap.lookupMaybe(PDFName.of('D'), PDFDict);
    for (const [, ref] of down?.entries() ?? []) if (ref instanceof PDFRef) doc.context.delete(ref);
    ap.delete(PDFName.of('D'));
  }
}
