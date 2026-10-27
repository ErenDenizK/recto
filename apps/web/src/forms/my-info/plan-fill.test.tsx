import type { PageId } from '@pdf-editor/document-model';
import { getActiveDocument } from '@pdf-editor/document-model';
import type { FormField } from '@pdf-editor/engine';
import { beforeEach, describe, expect, it } from 'vitest';

import formsAUrl from '../../../../../test/fixtures/forms-a.pdf?url';
import formsBUrl from '../../../../../test/fixtures/forms-b.pdf?url';
import { fixtureFile } from '../../../test/store-harness';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import {
  type FieldStop,
  fieldStops,
  isFillable,
  resetFormStore,
  useFormStore,
} from '../form-store';
import '../index';
import { type MyInfo, planFill } from './plan-fill';

const INFO: MyInfo = {
  givenName: 'Ayşe',
  familyName: 'Yılmaz',
  email: 'ayse@example.com',
  tel: '+90 532 123 45 67',
  birthDate: '1990-03-07',
  street: 'Atatürk Cd. 12/3',
  street2: 'Kat 4',
  district: 'Kadıköy',
  city: 'İstanbul',
  postalCode: '34710',
  country: 'Turkey',
  organization: 'Örnek A.Ş.',
  jobTitle: 'Mühendis',
  nationalId: '10000000146',
};

const PAGE = 'p1' as PageId;
let n = 0;
function stop(name: string, extra: Partial<FormField> = {}): FieldStop {
  const field: FormField = {
    name,
    kind: 'text',
    pageIndex: 0,
    rect: { x: 0, y: 0, width: 100, height: 20 },
    readOnly: false,
    required: false,
    ...extra,
  };
  return { fieldId: `f${n++}` as never, name, widget: 0, pageId: PAGE, position: 0, field };
}
const plan = (stops: FieldStop[], info: MyInfo = INFO, locale = 'en') =>
  planFill(stops, info, { locale });
const one = (name: string, extra: Partial<FormField> = {}, info: MyInfo = INFO, locale = 'en') =>
  plan([stop(name, extra)], info, locale)[0];

describe('planFill (BM-4)', () => {
  it('fills a name, an email and the address parts, ticked, in stop order', () => {
    const rows = plan([stop('Email'), stop('Ad'), stop('Soyadı'), stop('Posta Kodu')]);
    expect(rows.map((r) => [r.token, r.value, r.ticked, r.confidence])).toEqual([
      ['email', 'ayse@example.com', true, 'high'],
      ['given-name', 'Ayşe', false, 'low'],
      ['family-name', 'Yılmaz', true, 'high'],
      ['postal-code', '34710', true, 'high'],
    ]);
    expect(rows[1]?.reason).toBe('low-confidence');
  });

  it('derives the full name, and prefers a stored one', () => {
    expect(one('Full name')?.value).toBe('Ayşe Yılmaz');
    expect(one('Full name', {}, { ...INFO, fullName: 'Dr. Ayşe Yılmaz' })?.value).toBe(
      'Dr. Ayşe Yılmaz',
    );
  });

  it('offers the My-info-only tokens', () => {
    expect(one('Job title')?.value).toBe('Mühendis');
    expect(one('TC Kimlik No')?.value).toBe('10000000146');
    expect(one('İlçe')?.value).toBe('Kadıköy');
    expect(one('Şehir')?.value).toBe('İstanbul');
  });

  it('puts both address lines in a multi-line street field', () => {
    expect(one('Address', { multiline: true })?.value).toBe('Atatürk Cd. 12/3\nKat 4');
    expect(one('Address')?.value).toBe('Atatürk Cd. 12/3');
    expect(one('Address line 2')?.value).toBe('Kat 4');
  });

  it('skips tokens the profile has no value for', () => {
    expect(plan([stop('Job title')], { givenName: 'Ayşe' })).toEqual([]);
  });

  it.each([
    'Name of child',
    'Spouse phone',
    'Anne adı',
    'Emergency contact email',
    'Bank name',
    'User name',
  ])('never offers the ELSEWHERE field %s', (name) => {
    expect(plan([stop(name)])).toEqual([]);
  });

  it('never offers passwords, read-only fields, buttons, signatures, checkboxes or radios', () => {
    const rows = plan([
      stop('Email', { password: true }),
      stop('Email', { readOnly: true }),
      stop('Email', { kind: 'button' }),
      stop('Email', { kind: 'signature' }),
      stop('Email', { kind: 'checkbox', value: false }),
      stop('Email', { kind: 'radio', options: ['a'] }),
      stop('Email', { kind: 'listbox', options: ['a'] }),
    ]);
    expect(rows).toEqual([]);
  });

  it('leaves a filled field unticked and shows its value', () => {
    const row = one('Email', { value: 'old@example.com' });
    expect(row).toMatchObject({ ticked: false, reason: 'filled', current: 'old@example.com' });
    expect(row?.value).toBe('ayse@example.com');
  });

  it('unticks the second and later occurrences of a token', () => {
    const rows = plan([stop('Email'), stop('E-posta'), stop('Telefon')]);
    expect(rows.map((r) => [r.ticked, r.reason])).toEqual([
      [true, 'ready'],
      [false, 'duplicate'],
      [true, 'ready'],
    ]);
  });

  it('offers one row for a field with several widgets', () => {
    const a = stop('Email');
    const rows = plan([a, { ...a, widget: 1 }]);
    expect(rows).toHaveLength(1);
  });

  it('ticks a medium match and unticks a low one', () => {
    expect(one('Email address')).toMatchObject({ confidence: 'medium', ticked: true });
    expect(one('İl')).toMatchObject({ confidence: 'low', ticked: false });
  });

  describe('dates', () => {
    it.each([
      ['Doğum tarihi (gg.aa.yyyy)', '07.03.1990'],
      ['Birth date dd.mm.yyyy', '07.03.1990'],
      ['Birth date (dd/mm/yyyy)', '07/03/1990'],
      ['Birth date (mm/dd/yyyy)', '03/07/1990'],
      ['Birth date (yyyy-mm-dd)', '1990-03-07'],
      ['Birth date (dd/mm/yy)', '07/03/90'],
    ])('%s -> %s', (name, expected) => {
      expect(one(name)?.value).toBe(expected);
    });

    it('writes ddmmyyyy in an 8-character field', () => {
      expect(one('Date of birth', { maxLength: 8 })).toMatchObject({
        value: '07031990',
        ticked: true,
      });
      expect(one('Date of birth', { maxLength: 8, comb: true })?.value).toBe('07031990');
    });

    it('follows the locale without a pattern', () => {
      expect(one('Date of birth', {}, INFO, 'en')?.value).toBe('07/03/1990');
      expect(one('Doğum Tarihi', {}, INFO, 'tr')?.value).toBe('07.03.1990');
    });

    it('drops an impossible date', () => {
      expect(one('Date of birth', {}, { birthDate: '1990-02-31' })).toBeUndefined();
      expect(one('Date of birth', {}, { birthDate: 'soon' })).toBeUndefined();
    });
  });

  describe('capitals', () => {
    it.each(['Adı (büyük harf)', 'Name in BLOCK CAPITALS', 'Name (capital letters)'])(
      '%s',
      (name) => {
        expect(one(name, {}, { givenName: 'Işıl' })?.value).toBe('IŞIL');
      },
    );

    it('uses the Turkish rules', () => {
      expect(one('Ad (büyük harf)', {}, { givenName: 'ilker' })?.value).toBe('İLKER');
    });

    it('leaves an email alone', () => {
      expect(one('Email (block capitals)')?.value).toBe('ayse@example.com');
    });
  });

  describe('length', () => {
    it('lowers a value that overflows maxLength', () => {
      expect(one('Email', { maxLength: 10 })).toMatchObject({
        confidence: 'low',
        ticked: false,
        reason: 'overflow',
      });
      expect(one('Email', { maxLength: 40 })).toMatchObject({ ticked: true });
    });

    it('lowers a comb field with no length, accepts one that fits', () => {
      expect(one('Posta Kodu', { comb: true })).toMatchObject({ ticked: false, reason: 'comb' });
      expect(one('Posta Kodu', { comb: true, maxLength: 5 })).toMatchObject({ ticked: true });
    });
  });

  describe('phone', () => {
    it('keeps the number as saved in a plain field', () => {
      expect(one('Telefon')?.value).toBe('+90 532 123 45 67');
    });
    it('keeps digits only in a comb field', () => {
      expect(one('Telefon', { comb: true, maxLength: 12 })).toMatchObject({
        value: '905321234567',
        ticked: true,
      });
    });
    it('keeps digits only when the number would overflow', () => {
      expect(one('Telefon', { maxLength: 12 })?.value).toBe('905321234567');
      expect(one('Telefon', { maxLength: 11 })).toMatchObject({
        ticked: false,
        reason: 'overflow',
      });
    });
  });

  describe('combo boxes', () => {
    const country = { kind: 'combobox' as const, options: ['Canada', 'Türkiye', 'Turkey (TR)'] };
    it('gives the export value of the folded matching option', () => {
      expect(
        one('Country', { ...country, exportValues: ['CA', 'TR', 'TRX'] }, { country: 'turkıye' }),
      ).toMatchObject({ value: 'TR', ticked: true });
      expect(one('Ülke', country, { country: 'TÜRKİYE' })?.value).toBe('Türkiye');
    });
    it('lowers a combo box with no matching option', () => {
      expect(one('Country', country)).toMatchObject({
        confidence: 'low',
        ticked: false,
        reason: 'no-option',
      });
    });
    it('offers a free-text combo box without options, and no fixed one', () => {
      expect(one('Country', { kind: 'combobox', editable: true })).toMatchObject({ ticked: true });
      expect(one('Country', { kind: 'combobox' })).toBeUndefined();
    });
  });
});

describe('planFill on the form fixtures', () => {
  beforeEach(() => {
    resetWorkspace();
    resetFormStore();
  });

  async function stopsOf(url: string, name: string): Promise<FieldStop[]> {
    await useWorkspaceStore.getState().openFiles([await fixtureFile(url, name)]);
    const doc = getActiveDocument(useWorkspaceStore.getState().workspace);
    const ref = doc?.pages[0]?.ref;
    if (!doc || ref?.kind !== 'source') throw new Error('no source page');
    useFormStore.getState().ensureSource(ref.source);
    await expect.poll(() => useFormStore.getState().sources[ref.source]?.loaded).toBe(true);
    return fieldStops(doc, useFormStore.getState().sources).filter((s) => isFillable(s.field));
  }

  it.each([
    ['forms-a.pdf', formsAUrl],
    ['forms-b.pdf', formsBUrl],
  ])(
    '%s: offers the name, country and city fields; leaves filled ones unticked',
    async (name, url) => {
      const stops = await stopsOf(url, name);
      const rows = planFill(stops, INFO, { locale: 'en' });
      const byName = new Map(rows.map((r) => [r.stop.name, r]));
      // "name" only matches a name field when it is the whole label.
      expect(byName.get('name')).toMatchObject({ token: 'name', value: 'Ayşe Yılmaz' });
      expect(byName.has('agree')).toBe(false);
      expect(byName.has('choice')).toBe(false);
      for (const row of rows) {
        if (row.current !== '') expect(row).toMatchObject({ ticked: false, reason: 'filled' });
      }
      expect(byName.get('address.city')).toMatchObject({
        token: 'address-level2',
        value: 'İstanbul',
      });
    },
  );

  it('forms-a.pdf with its values cleared: everything high or medium is ticked', async () => {
    const stops = await stopsOf(formsAUrl, 'forms-a.pdf');
    const cleared = stops.map((s) => {
      const { value: _value, ...field } = s.field;
      return { ...s, field };
    });
    const rows = planFill(cleared, INFO, { locale: 'en' });
    const country = rows.find((r) => r.stop.name === 'country');
    expect(country).toMatchObject({ value: 'Turkey', reason: 'no-option', ticked: false });
    expect(rows.find((r) => r.stop.name === 'name')?.ticked).toBe(true);
    expect(rows.find((r) => r.stop.name === 'address.city')?.ticked).toBe(true);
  });
});
