/**
 * A camera JPEG as an upright one-page PDF (M1-b): the stamp path hands EmbedPDF a one-page PDF
 * as an image stamp's appearance (`EPDFAnnot_SetAppearanceFromPage`), so a JPEG whose EXIF turns
 * it is placed on a page of its upright size and drawn through `orientedImageMatrix`. The JPEG
 * bytes are embedded as they are (DCTDecode), never re-encoded.
 *
 * A stamp on a page with /Rotate (IM-19, DSN-81) also goes in as a one-page PDF: its content is
 * drawn at its displayed size (`imageStampPage`, `namedStampAppearance`) and `turnedStampPage`
 * counter-rotates it by the /Rotate onto a page of the /Rect's size, so it reads upright to the
 * viewer. EmbedPDF 2.15.1 cannot do this itself: it places a PNG or JPEG
 * (`addPngImageObject`, `addJpegImageObject`) with the rect's displayed size and no turn, so on
 * 90° and 270° the image fell outside the /BBox but for a 1 pt sliver, and on 180° wholly.
 */
import {
  concatTransformationMatrix,
  drawObject,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
} from '@cantoo/pdf-lib';

import { type JpegInfo, orientedImageMatrix, uprightSize } from './jpeg-orientation';

export async function uprightJpegPage(jpeg: Uint8Array, info: JpegInfo): Promise<ArrayBuffer> {
  const { width, height } = uprightSize(info);
  const doc = await PDFDocument.create({ updateMetadata: false });
  const page = doc.addPage([width, height]);
  const image = await doc.embedJpg(jpeg);
  const name = page.node.newXObject('Image', image.ref);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(...orientedImageMatrix(info.orientation, 0, 0, width, height)),
    drawObject(name),
    popGraphicsState(),
  );
  const bytes = await doc.save();
  return bytes.slice().buffer;
}

/** A PNG or JPEG stretched over a `width` × `height` page. */
export async function imageStampPage(
  image: Uint8Array,
  format: 'png' | 'jpeg',
  width: number,
  height: number,
): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const page = doc.addPage([width, height]);
  const embedded = format === 'png' ? await doc.embedPng(image) : await doc.embedJpg(image);
  const name = page.node.newXObject('Image', embedded.ref);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(width, 0, 0, height, 0, 0),
    drawObject(name),
    popGraphicsState(),
  );
  const bytes = await doc.save();
  return bytes.slice().buffer;
}

/**
 * Page 1 of `upright` (drawn as the viewer should see it) on a `width` × `height` page (the
 * /Rect, user space), turned back by the page's /Rotate: the page shows it turned `rotation`
 * clockwise, so it is drawn turned as much anticlockwise and reads upright.
 */
export async function turnedStampPage(
  upright: ArrayBuffer,
  rotation: 90 | 180 | 270,
  width: number,
  height: number,
): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const page = doc.addPage([width, height]);
  const [form] = await doc.embedPdf(upright, [0]);
  if (!form) throw new Error('The stamp appearance has no page');
  // Scales the source onto the displayed size (width and height swap on a quarter turn).
  const odd = rotation !== 180;
  const sx = (odd ? height : width) / form.width;
  const sy = (odd ? width : height) / form.height;
  const matrix: Record<typeof rotation, [number, number, number, number, number, number]> = {
    90: [0, sx, -sy, 0, width, 0],
    180: [-sx, 0, 0, -sy, width, height],
    270: [0, -sx, sy, 0, 0, height],
  };
  const name = page.node.newXObject('Stamp', form.ref);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(...matrix[rotation]),
    drawObject(name),
    popGraphicsState(),
  );
  const bytes = await doc.save();
  return bytes.slice().buffer;
}
