import type { FormField } from '@pdf-editor/engine';
import { describe, expect, it } from 'vitest';

import { autofillToken } from './autofill-hint';

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
