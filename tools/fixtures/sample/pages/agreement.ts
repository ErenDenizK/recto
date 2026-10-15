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

  // The card: one rhythm. Every group is a label and its controls, groups 72 pt apart label to
  // label (47 px at a phone's fit width: MOB-1's targets never overlap), plus 32 pt for the
  // fee's second radio; the card ends one padding under the signature lines.
  const cardTop = y - 14;
  const form = doc.getForm();
  const x0 = LEFT + PAD;
  const l1 = cardTop - PAD - 44;
  const l2 = l1 - PITCH;
  const l3 = l2 - PITCH;
  const l4 = l3 - PITCH - 32;
  const l5 = l4 - PITCH;
  const lineY = l5 - 44;
  const cardBottom = lineY - 30;
  if (cardBottom < 104) throw new Error(`agreement: the card overflows (${r2(cardBottom)})`);
  w.art(...roundRect(LEFT, cardBottom, MEASURE, cardTop - cardBottom, 10, PALE));
  w.text(w.elem('H2'), { face: 'bold', size: 13, color: INK }, x0, cardTop - PAD - 10, c.cardTitle);

  const label = (x: number, ly: number, value: string) =>
    w.text(null, STYLE.label, x, ly, up(value));
  const tag = (widget: PDFWidgetAnnotation | undefined) => {
    const ref = widget ? doc.context.getObjectRef(widget.dict) : undefined;
    if (ref instanceof PDFRef) w.tags.annot(w.elem('Form'), ref, w.page);
  };
  /** A check box or radio's box, centred 21 pt under its group's label line. */
  const box = {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: rgb(...MUTED),
    backgroundColor: rgb(...WHITE),
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

  // Name and date; email.
  textField('name', c.name, x0, l1, 250);
  textField('date', c.date, x0 + 270, l1, 150);
  textField('email', c.email, x0, l2, 250);

  // The fee: one radio group, its two options 32 pt apart.
  label(x0, l3, c.feeLabel);
  const fee = form.createRadioGroup('fee');
  fee.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(c.feeLabel));
  const option = (value: string, text: string, cy: number) => {
    fee.addOptionToPage(value, w.page, { ...box, x: x0, y: r2(cy - 7) });
    w.text(w.elem('P'), STYLE.ui, x0 + 24, cy - 3, text);
  };
  option('transfer', c.feeTransfer, l3 - 21);
  option('trust', c.feeTrust, l3 - 21 - 32);
  for (const widget of fee.acroField.getWidgets()) tag(widget);
  dropDownAppearances(doc, fee.acroField.getWidgets());

  // Consent.
  label(x0, l4, c.consentLabel);
  const agree = form.createCheckBox('agree');
  agree.addToPage(w.page, { ...box, x: x0, y: r2(l4 - 21 - 7) });
  agree.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(c.agree));
  tag(agree.acroField.getWidgets()[0]);
  dropDownAppearances(doc, agree.acroField.getWidgets());
  w.text(null, STYLE.ui, x0 + 24, l4 - 24, c.agree);

  // Where to sign, and the place and date beside it: drawn lines, as on paper (the Sign tool
  // places the signature on the first).
  label(x0, l5, c.signature);
  label(x0 + 270, l5, c.place);
  w.art(...hairline(x0, lineY, x0 + 250, lineY, INK, 0.75));
  w.art(...hairline(x0 + 270, lineY, x0 + 420, lineY, INK, 0.75));
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
