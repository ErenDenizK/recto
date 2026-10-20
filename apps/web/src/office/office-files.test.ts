import { afterEach, describe, expect, it } from 'vitest';

import { decideOfficeFlag, OFFICE_FLAG_KEY, officeEnabled, resetOfficeFlag } from './flag';
import { isOfficeFile, OFFICE_ACCEPT, officeExtension, pdfNameFor } from './office-files';

const named = (name: string, type = '') => ({ name, type });

describe('Office files (ADR-0035 §5)', () => {
  it('knows Word, Excel and PowerPoint by extension, in any case', () => {
    expect(officeExtension('report.docx')).toBe('docx');
    expect(officeExtension('Budget.XLSX')).toBe('xlsx');
    expect(officeExtension('deck.pptx')).toBe('pptx');
    expect(officeExtension('old.doc')).toBeUndefined();
    expect(officeExtension('notes.odt')).toBeUndefined();
    expect(officeExtension('report.pdf')).toBeUndefined();
  });

  it('skips hidden files such as macOS resource forks', () => {
    expect(isOfficeFile(named('report.docx'))).toBe(true);
    expect(isOfficeFile(named('._report.docx'))).toBe(false);
  });

  it('names the converted PDF after the file', () => {
    expect(pdfNameFor('report.docx')).toBe('report.pdf');
    expect(pdfNameFor('Q3 plan.final.pptx')).toBe('Q3 plan.final.pdf');
  });

  it('offers the three types to the file dialog', () => {
    for (const ext of ['.docx', '.xlsx', '.pptx']) expect(OFFICE_ACCEPT).toContain(ext);
  });
});

describe('the Office flag (ADR-0035 §6)', () => {
  afterEach(() => {
    localStorage.removeItem(OFFICE_FLAG_KEY);
    resetOfficeFlag();
  });

  it('is off by default; ?office=1 turns it on and ?office=0 off, over the stored choice', () => {
    expect(decideOfficeFlag('', null)).toBe(false);
    expect(decideOfficeFlag('?office=1', null)).toBe(true);
    expect(decideOfficeFlag('', '1')).toBe(true);
    expect(decideOfficeFlag('?office=0', '1')).toBe(false);
    expect(decideOfficeFlag('?lang=tr', '1')).toBe(true);
  });

  it('reads the stored choice when the address says nothing', () => {
    expect(officeEnabled()).toBe(false);
    resetOfficeFlag();
    localStorage.setItem(OFFICE_FLAG_KEY, '1');
    expect(officeEnabled()).toBe(true);
  });
});
