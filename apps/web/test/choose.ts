/**
 * Chooses an option of a `ui/Select` (Base UI's combobox trigger and listbox popup) the way a
 * person does: a press on the trigger, then on the option. A string matches the option's value
 * (`data-value`); `{ name }` matches its label instead.
 */
import { screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';

export async function chooseOption(
  trigger: HTMLElement,
  option: string | { readonly name: string | RegExp },
): Promise<void> {
  await userEvent.click(trigger);
  const listbox = await screen.findByRole('listbox');
  const target =
    typeof option === 'string'
      ? listbox.querySelector<HTMLElement>(`[role="option"][data-value="${CSS.escape(option)}"]`)
      : await screen.findByRole('option', { name: option.name });
  if (!target) throw new Error(`no option ${JSON.stringify(option)}`);
  await userEvent.click(target);
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
}
