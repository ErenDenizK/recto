import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { setLocale } from '../i18n';
import { Avatar, initialOf } from './Avatar';
import { Badge, badgeText } from './Badge';
import { DotStack, Tag, TagDot, tagSlot } from './Tag';

describe('Badge (09-primitives §17)', () => {
  it('caps at 99+ and hides at zero', () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(-2)).toBeNull();
    expect(badgeText(7)).toBe('7');
    expect(badgeText(99)).toBe('99');
    expect(badgeText(100)).toBe('99+');
  });

  it('is a decorative 16 px pill in tabular numerals; the count pops only on an increase', () => {
    const { container, rerender } = render(<Badge count={3} />);
    const badge = container.querySelector('[data-kind="count"]') as HTMLElement;
    expect(badge).toHaveAttribute('aria-hidden', 'true');
    expect(badge.getBoundingClientRect().height).toBe(16);
    expect(getComputedStyle(badge).fontVariantNumeric).toBe('tabular-nums');
    expect(badge).not.toHaveAttribute('data-pop');
    rerender(<Badge count={4} />);
    expect(container.querySelector('[data-kind="count"]')).toHaveAttribute('data-pop');
    rerender(<Badge count={0} />);
    expect(container.querySelector('[data-kind="count"]')).toBeNull();
  });

  it('draws a status as a glyph and words, never colour alone', () => {
    render(
      <Badge kind="status" tone="success" icon={<svg data-testid="seal" />}>
        Valid
      </Badge>,
    );
    expect(screen.getByText('Valid')).toBeVisible();
    expect(screen.getByTestId('seal').getBoundingClientRect().width).toBe(12);
  });
});

describe('Tag dot, tag and dot stack (09-primitives §18)', () => {
  it('maps any colour index to one of six stable slots', () => {
    expect([0, 1, 5, 6, 13, -1].map(tagSlot)).toEqual([0, 1, 5, 0, 1, 5]);
  });

  it('draws an 8 px dot in the tag colour, hidden from assistive technology', () => {
    const { container } = render(<TagDot index={2} />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(dot.getBoundingClientRect().width).toBe(8);
    expect(getComputedStyle(dot).backgroundColor).toBe('rgb(197, 139, 157)');
  });

  it('a tag is the dot and the name, which carries its full text', () => {
    render(<Tag index={0} name="report-final.pdf" />);
    expect(screen.getByText('report-final.pdf')).toHaveAttribute('title', 'report-final.pdf');
  });

  it('stacks three dots and counts the rest', () => {
    const { container } = render(<DotStack indexes={[0, 1, 2, 3, 4]} />);
    expect(container.querySelectorAll('[data-tag-slot]')).toHaveLength(3);
    expect(container.textContent).toBe('+2');
  });
});

describe('Avatar (09-primitives §18)', () => {
  it('shows the first letter, upper-cased in the interface locale', () => {
    expect(initialOf('  deniz', 'en')).toBe('D');
    expect(initialOf('ilke', 'tr')).toBe('İ');
    expect(initialOf('ilke', 'en')).toBe('I');
    expect(initialOf('', 'en')).toBeNull();
    expect(initialOf('  ', 'en')).toBeNull();
  });

  it('is an image named by the author, or "Unknown author" with the user glyph', () => {
    setLocale('en');
    render(
      <>
        <Avatar name="Deniz" index={1} />
        <Avatar name={null} index={0} size={24} />
      </>,
    );
    const author = screen.getByRole('img', { name: 'Deniz' });
    expect(author.textContent).toBe('D');
    expect(author.getBoundingClientRect().width).toBe(20);
    const unknown = screen.getByRole('img', { name: 'Unknown author' });
    expect(unknown.querySelector('svg')).not.toBeNull();
    expect(unknown.getBoundingClientRect().width).toBe(24);
  });

  it('hides itself when the name is beside it', () => {
    const { container } = render(<Avatar name="Deniz" index={1} decorative />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).toBeNull();
  });
});
