/**
 * A camera JPEG as an upright one-page PDF (M1-b): the stamp path hands EmbedPDF a one-page PDF
 * as an image stamp's appearance (`EPDFAnnot_SetAppearanceFromPage`), so a JPEG whose EXIF turns
 * it is placed on a page of its upright size and drawn through `orientedImageMatrix`. The JPEG
 * bytes are embedded as they are (DCTDecode), never re-encoded.
 *
 * `imageStampPage` takes the same path for a PNG or upright JPEG stamp on a page with /Rotate
 * (IM-19): EmbedPDF 2.15.1 places such an image (`addPngImageObject`, `addJpegImageObject`)
 * with the rect's displayed width and height and no turn, so on 90° and 270° it falls outside
 * the appearance's /BBox but for a 1 pt sliver, and on 180° wholly outside it. A page of the
 * rect's size with the image stretched over it draws as an unrotated page does: the image fills
 * the rect in user space.
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

/** A PNG or JPEG stretched over a `width` × `height` page (an image stamp on a rotated page). */
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
