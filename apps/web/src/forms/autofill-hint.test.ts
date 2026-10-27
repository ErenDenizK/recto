import type { FormField } from '@pdf-editor/engine';
import { describe, expect, it } from 'vitest';

import { autofillToken, type FieldMatch, matchField, type MatchConfidence } from './autofill-hint';

type Extra = Partial<Pick<FormField, 'tooltip' | 'password' | 'multiline' | 'kind' | 'options'>>;
const token = (name: string, extra: Extra = {}) => autofillToken({ name, ...extra });

describe('autofillToken (PRD-32)', () => {
  it.each([
    ['Your name', 'name'],
    ['Ad Soyad', 'name'],
    ['Adı ve Soyadı', 'name'],
    ['First and last name', 'name'],
    ['Name and surname', 'name'],
    ['firstName', 'given-name'],
    ['Ad', 'given-name'],
    ['Last name', 'family-name'],
    ['Soyadı', 'family-name'],
    ['E-posta', 'email'],
    ['Email address', 'email'],
    ['Telefon', 'tel'],
    ['Street address', 'address-line1'],
    ['Adres', 'address-line1'],
    ['Company address', 'address-line1'],
    ['Firma adresi', 'address-line1'],
    ['Address line 2', 'address-line2'],
    ['Adres 2', 'address-line2'],
    ['Şehir', 'address-level2'],
    ['Company city', 'address-level2'],
    ['İlçe', 'address-level2'],
    ['İl', 'address-level1'],
    ['Posta Kodu', 'postal-code'],
    ['ZIP', 'postal-code'],
    ['ZIPCode', 'postal-code'],
    ['Adınız', 'name'],
    ['Adınız Soyadınız', 'name'],
    ['Soyadınız', 'family-name'],
    ['E-postası', 'email'],
    ['Epostası', 'email'],
    ['E-posta adresiniz', 'email'],
    ['User email', 'email'],
    ['Kullanıcı e-postası', 'email'],
    ['Telefonu', 'tel'],
    ['Telefonunuz', 'tel'],
    ['Telefon numaranız', 'tel'],
    ['Adresiniz', 'address-line1'],
    ['Ülke', 'country-name'],
    ['Company name', 'organization'],
    ['Kurum', 'organization'],
    ['Doğum Tarihi', 'bday'],
    ['Date of birth', 'bday'],
  ])('%s -> %s', (name, expected) => {
    expect(token(name)).toBe(expected);
  });

  it.each([
    'Doğum Yeri',
    'Adet',
    'Adreslerim',
    'Name of child',
    'Emergency contact name',
    'Baba Adı',
    'Anne adı',
    'User name',
    'Kullanıcı adı',
    'File name',
    'Bank name',
    'Eş adı',
    'Spouse name',
    'Signature date',
    'Invoice number',
  ])('%s stays off', (name) => {
    expect(token(name)).toBe('off');
  });

  it('keeps street-address for the multi-line field only', () => {
    expect(token('Address', { multiline: true })).toBe('street-address');
    expect(token('Address')).toBe('address-line1');
  });

  it('prefers the tooltip, then the name', () => {
    expect(token('Text1', { tooltip: 'Telefon numaranız' })).toBe('tel');
    expect(token('email', { tooltip: 'Contact' })).toBe('email');
  });

  it('keeps passwords and editable combo boxes with choices off', () => {
    expect(token('Name', { password: true })).toBe('off');
    expect(token('Country', { kind: 'combobox', options: ['Canada'] })).toBe('off');
    expect(token('Country', { kind: 'combobox' })).toBe('country-name');
  });
});

type MatchExtra = Partial<Pick<FormField, 'tooltip' | 'password'>>;
const match = (name: string, extra: MatchExtra = {}) => matchField({ name, ...extra });

describe('matchField (BM-4, PRD-32 amended)', () => {
  const H: MatchConfidence = 'high';
  const M: MatchConfidence = 'medium';
  const L: MatchConfidence = 'low';
  // [name, tooltip, token, confidence]
  const corpus: readonly (readonly [string, string | undefined, string, MatchConfidence])[] = [
    ['Your name', undefined, 'name', H],
    ['Ad Soyad', undefined, 'name', H],
    ['Adı ve Soyadı', undefined, 'name', H],
    ['First and last name', undefined, 'name', H],
    ['Name and surname', undefined, 'name', H],
    ['Full name', undefined, 'name', H],
    ['Adınız', undefined, 'name', H],
    ['Adınız Soyadınız', undefined, 'name', H],
    ['firstName', undefined, 'given-name', H],
    ['Given name', undefined, 'given-name', H],
    ['Ad', undefined, 'given-name', L],
    ['Adı', undefined, 'given-name', H],
    ['Last name', undefined, 'family-name', H],
    ['Soyadı', undefined, 'family-name', H],
    ['Soyadınız', undefined, 'family-name', H],
    ['Surname', undefined, 'family-name', H],
    ['E-posta', undefined, 'email', H],
    ['Email', undefined, 'email', H],
    ['Email address', undefined, 'email', M],
    ['E-posta adresiniz', undefined, 'email', H],
    ['Kullanıcı e-postası', undefined, 'email', H],
    ['Telefon', undefined, 'tel', H],
    ['Tel', undefined, 'tel', H],
    ['Phone', undefined, 'tel', H],
    ['Mobile phone', undefined, 'tel', M],
    ['Telefon numaranız', undefined, 'tel', M],
    ['GSM', undefined, 'tel', H],
    ['Cep Telefonu', undefined, 'tel', M],
    ['Street address', undefined, 'street-address', H],
    ['Adres', undefined, 'street-address', H],
    ['Adresiniz', undefined, 'street-address', H],
    ['Company address', undefined, 'street-address', M],
    ['Ev Adresi', undefined, 'street-address', M],
    ['Address line 2', undefined, 'address-line2', H],
    ['Adres 2', undefined, 'address-line2', H],
    ['Şehir', undefined, 'address-level2', H],
    ['City', undefined, 'address-level2', H],
    ['Company city', undefined, 'address-level2', M],
    ['İlçe', undefined, 'address-level2', H],
    ['İl', undefined, 'address-level1', L],
    ['Posta Kodu', undefined, 'postal-code', H],
    ['Postal code', undefined, 'postal-code', H],
    ['ZIP', undefined, 'postal-code', H],
    ['ZIPCode', undefined, 'postal-code', H],
    ['Ülke', undefined, 'country-name', H],
    ['Country', undefined, 'country-name', H],
    ['Company name', undefined, 'organization', M],
    ['Kurum', undefined, 'organization', H],
    ['Şirket', undefined, 'organization', H],
    ['Employer', undefined, 'organization', H],
    ['Doğum Tarihi', undefined, 'bday', H],
    ['Date of birth', undefined, 'bday', H],
    ['DOB', undefined, 'bday', H],
    ['Birthday', undefined, 'bday', H],
    ['Job title', undefined, 'job-title', H],
    ['Title', undefined, 'job-title', H],
    ['Unvan', undefined, 'job-title', H],
    ['Görev', undefined, 'job-title', H],
    ['Company title', undefined, 'job-title', M],
    ['T.C. Kimlik No', undefined, 'national-id', H],
    ['TC Kimlik No', undefined, 'national-id', H],
    ['TCKN', undefined, 'national-id', H],
    ['Kimlik No', undefined, 'national-id', H],
    ['National ID', undefined, 'national-id', H],
    ['Text1', 'Telefon numaranız', 'tel', M],
    ['Text2', 'Full name', 'name', H],
    ['Text3', 'Your e-mail', 'email', H],
    ['Field4', 'Postal code (5 digits)', 'postal-code', H],
    ['email', 'Contact', 'email', M],
    ['tel', 'Contact', 'tel', M],
    ['Text5', 'Doğum tarihi (gg.aa.yyyy)', 'bday', H],
  ];

  it('has a corpus of at least 60 labels', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(60);
  });

  it.each(corpus)('%s / %s -> %s (%s)', (name, tooltip, token, confidence) => {
    const got = match(name, tooltip === undefined ? {} : { tooltip });
    expect(got).toMatchObject({ token, confidence } satisfies Partial<FieldMatch>);
  });

  it('says where the match came from', () => {
    expect(match('Text1', { tooltip: 'Telefon' })).toMatchObject({ from: 'tooltip' });
    expect(match('Telefon')).toMatchObject({ from: 'name', phrase: 'telefon' });
  });

  it.each([
    'Doğum Yeri',
    'Adet',
    'Adreslerim',
    'Name of child',
    'Child phone',
    'Emergency contact phone',
    'Baba Adı',
    'Anne adı',
    'Anne Cep Telefonu',
    'User name',
    'Kullanıcı adı',
    'File name',
    'Bank name',
    'Eş adı',
    'Spouse name',
    'Spouse job title',
    'Acil durum telefon',
    'Signature date',
    'Invoice number',
    'Text1',
    'ID number',
  ])('%s matches nothing', (name) => {
    expect(match(name)).toBeNull();
  });

  it('lets an ELSEWHERE word in either text veto the match', () => {
    expect(match('Phone', { tooltip: 'Child phone' })).toBeNull();
    expect(match('Child phone', { tooltip: 'Phone' })).toBeNull();
  });

  it('matches nothing for a password field', () => {
    expect(match('Name', { password: true })).toBeNull();
  });

  it('adds job-title and national-id for My info only', () => {
    expect(token('Job title')).toBe('off');
    expect(token('Unvan')).toBe('off');
    expect(token('TC Kimlik No')).toBe('off');
    expect(token('National ID')).toBe('off');
    expect(token('Company title')).toBe('organization');
  });
});
