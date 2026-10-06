import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { ICONS } from './icons.generated';
import { stillStyles } from './test-states';

stillStyles();

const box = (el: Element) => el.getBoundingClientRect();
const weights = (svg: Element) => {
  const [regular, fill] = [...svg.querySelectorAll(':scope > g')];
  if (!regular || !fill) throw new Error('no twin');
  return { regular: getComputedStyle(regular).opacity, fill: getComputedStyle(fill).opacity };
};

describe('Icon (09-primitives §30, ADR-0027 §2.7)', () => {
  it('draws Phosphor path data on the 256 grid in currentColor, hidden from assistive tech', () => {
    const { container } = render(<Icon name="x" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 256 256');
    expect(svg).toHaveAttribute('fill', 'currentColor');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg?.querySelector('path')).toHaveAttribute('d', ICONS.x.r[0]);
    // An action glyph has no twin and never swaps (I-2).
    expect(svg).not.toHaveAttribute('data-filled');
  });

  it('takes a label as its accessible name when it stands alone', () => {
    render(<Icon name="warning" label="Warning" />);
    expect(screen.getByRole('img', { name: 'Warning' })).not.toHaveAttribute('aria-hidden');
  });

  it('is 16 px by default, `size` where no control sizes it, the control’s size inside one', () => {
    render(
      <>
        <Icon name="info" data-testid="plain" />
        <Icon name="info" size={20} data-testid="sized" />
        <IconButton label="Close" icon={<Icon name="x" data-testid="bar" size={16} />} />
        <IconButton label="Delete" size="row" icon={<Icon name="trash" data-testid="row" />} />
      </>,
    );
    expect(box(screen.getByTestId('plain'))).toMatchObject({ width: 16, height: 16 });
    expect(box(screen.getByTestId('sized'))).toMatchObject({ width: 20, height: 20 });
    // Quality-bar Q-9: 20 px in a bar control, 16 px in a row, whatever the call site says.
    expect(box(screen.getByTestId('bar'))).toMatchObject({ width: 20, height: 20 });
    expect(box(screen.getByTestId('row'))).toMatchObject({ width: 16, height: 16 });
  });

  it('rests in outline and fills inside a pressed, checked, selected or current control', () => {
    render(
      <>
        <Icon name="pen" data-testid="rest" />
        <IconButton label="Pen" aria-pressed icon={<Icon name="pen" data-testid="pressed" />} />
        <div role="radio" aria-checked="true">
          <Icon name="rows" data-testid="checked" />
        </div>
        <div role="tab" aria-selected="true">
          <Icon name="files" data-testid="selected" />
        </div>
        <a href="#here" aria-current="page">
          <Icon name="squares-four" data-testid="current" />
        </a>
        <IconButton label="Off" aria-pressed={false} icon={<Icon name="pen" data-testid="off" />} />
      </>,
    );
    expect(weights(screen.getByTestId('rest'))).toEqual({ regular: '1', fill: '0' });
    expect(weights(screen.getByTestId('off'))).toEqual({ regular: '1', fill: '0' });
    for (const id of ['pressed', 'checked', 'selected', 'current']) {
      expect(weights(screen.getByTestId(id)), id).toEqual({ regular: '0', fill: '1' });
    }
  });

  it('`filled` forces either weight', () => {
    render(
      <>
        <Icon name="cursor" filled data-testid="on" />
        <IconButton
          label="Select"
          aria-pressed
          icon={<Icon name="cursor" filled={false} data-testid="never" />}
        />
      </>,
    );
    expect(weights(screen.getByTestId('on'))).toEqual({ regular: '0', fill: '1' });
    expect(weights(screen.getByTestId('never'))).toEqual({ regular: '1', fill: '0' });
  });
});
