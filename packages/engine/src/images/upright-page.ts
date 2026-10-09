/**
 * A camera JPEG as an upright one-page PDF (M1-b): the stamp path hands EmbedPDF a one-page PDF
 * as an image stamp's appearance (`EPDFAnnot_SetAppearanceFromPage`), so a JPEG whose EXIF turns
 * it is placed on a page of its upright size and drawn through `orientedImageMatrix`. The JPEG
 * bytes are embedded as they are (DCTDecode), never re-encoded.
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
