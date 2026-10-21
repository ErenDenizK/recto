/**
 * Minimal spreadsheet and presentation files for the Office conversion test (ADR-0035 §7,
 * EDN-20), built beside the Word builder in `docx.ts` and its stored zip: no dependency, nothing
 * committed.
 */
import { escape, zip } from './docx';

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const RELS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const DOC_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const PKG_RELS = (target: string) =>
  `${XML}<Relationships xmlns="${RELS}">` +
  `<Relationship Id="rId1" Type="${DOC_REL}/officeDocument" Target="${target}"/></Relationships>`;

/** A .xlsx with one sheet named `sheet`: `rows` as inline strings (no shared strings part). */
export function xlsx(rows: readonly (readonly string[])[], sheet = 'Sheet1'): Buffer {
  const cells = rows
    .map(
      (row, r) =>
        `<row r="${r + 1}">${row
          .map(
            (text, c) =>
              `<c r="${String.fromCharCode(65 + c)}${r + 1}" t="inlineStr"><is><t>${escape(text)}</t></is></c>`,
          )
          .join('')}</row>`,
    )
    .join('');
  return zip({
    '[Content_Types].xml':
      `${XML}<Types xmlns="${CT}">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '</Types>',
    '_rels/.rels': PKG_RELS('xl/workbook.xml'),
    'xl/workbook.xml':
      `${XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${DOC_REL}">` +
      `<sheets><sheet name="${escape(sheet)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      `${XML}<Relationships xmlns="${RELS}">` +
      `<Relationship Id="rId1" Type="${DOC_REL}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml':
      `${XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<sheetData>${cells}</sheetData></worksheet>`,
  });
}

/** A .pptx with one slide per entry of `titles` (a text box each, on a blank layout). */
export function pptx(titles: readonly string[]): Buffer {
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
  const slideEntries: Record<string, string> = {};
  titles.forEach((title, i) => {
    slideEntries[`ppt/slides/slide${i + 1}.xml`] =
      `${XML}<p:sld xmlns:a="${A}" xmlns:r="${DOC_REL}" xmlns:p="${P}"><p:cSld><p:spTree>` +
      '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
      '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>' +
      '<p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="7315200" cy="1143000"/></a:xfrm>' +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
      `<p:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="en-US" sz="4000"/><a:t>${escape(title)}</a:t></a:r></a:p></p:txBody></p:sp>` +
      '</p:spTree></p:cSld></p:sld>';
    slideEntries[`ppt/slides/_rels/slide${i + 1}.xml.rels`] =
      `${XML}<Relationships xmlns="${RELS}">` +
      `<Relationship Id="rId1" Type="${DOC_REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;
  });
  const tree =
    '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>';
  return zip({
    '[Content_Types].xml':
      `${XML}<Types xmlns="${CT}">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
      '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
      '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
      titles
        .map(
          (_, i) =>
            `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
        )
        .join('') +
      '</Types>',
    '_rels/.rels': PKG_RELS('ppt/presentation.xml'),
    'ppt/presentation.xml':
      `${XML}<p:presentation xmlns:a="${A}" xmlns:r="${DOC_REL}" xmlns:p="${P}">` +
      '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
      `<p:sldIdLst>${titles.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')}</p:sldIdLst>` +
      '<p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>',
    'ppt/_rels/presentation.xml.rels':
      `${XML}<Relationships xmlns="${RELS}">` +
      `<Relationship Id="rId1" Type="${DOC_REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/>` +
      titles
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 2}" Type="${DOC_REL}/slide" Target="slides/slide${i + 1}.xml"/>`,
        )
        .join('') +
      '</Relationships>',
    'ppt/slideMasters/slideMaster1.xml':
      `${XML}<p:sldMaster xmlns:a="${A}" xmlns:r="${DOC_REL}" xmlns:p="${P}">${tree}` +
      '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
      '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>',
    'ppt/slideMasters/_rels/slideMaster1.xml.rels':
      `${XML}<Relationships xmlns="${RELS}">` +
      `<Relationship Id="rId1" Type="${DOC_REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`,
    'ppt/slideLayouts/slideLayout1.xml': `${XML}<p:sldLayout xmlns:a="${A}" xmlns:r="${DOC_REL}" xmlns:p="${P}" type="blank">${tree}</p:sldLayout>`,
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels':
      `${XML}<Relationships xmlns="${RELS}">` +
      `<Relationship Id="rId1" Type="${DOC_REL}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`,
    ...slideEntries,
  });
}
