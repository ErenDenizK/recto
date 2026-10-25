import { describe, expect, it } from 'vitest';

import { autofillToken } from './autofill-hint';

const token = (name: string, tooltip?: string, password?: boolean) =>
  autofillToken({
    name,
    ...(tooltip === undefined ? {} : { tooltip }),
    ...(password === undefined ? {} : { password }),
  });

describe('autofillToken (PRD-32)', () => {
  it.each([
    ['Your name', 'name'],
    ['Ad Soyad', 'name'],
    ['firstName', 'given-name'],
    ['Ad', 'given-name'],
    ['Last name', 'family-name'],
    ['Soyadı', 'family-name'],
    ['E-posta', 'email'],
    ['Email address', 'email'],
    ['Telefon', 'tel'],
    ['Street address', 'street-address'],
    ['Adres', 'street-address'],
    ['Şehir', 'address-level2'],
    ['İl', 'address-level2'],
    ['Posta Kodu', 'postal-code'],
    ['ZIP', 'postal-code'],
    ['Ülke', 'country-name'],
    ['Company name', 'organization'],
    ['Kurum', 'organization'],
    ['Doğum Tarihi', 'bday'],
    ['Date of birth', 'bday'],
  ])('%s -> %s', (name, expected) => {
    expect(token(name)).toBe(expected);
  });

  it('prefers the tooltip, then the name', () => {
    expect(token('Text1', 'Telefon numaranız')).toBe('tel');
    expect(token('email', 'Contact')).toBe('email');
  });

  it('keeps unmatched fields and passwords off', () => {
    expect(token('Signature date')).toBe('off');
    expect(token('Invoice number')).toBe('off');
    expect(token('Name', undefined, true)).toBe('off');
  });
});
