/**
 * Roving tabindex for the tool bar and its options tier (DESIGN.md §5, experience-redesign
 * spec §10): one Tab stop per toolbar; Left/Right move between its controls and Home/End go
 * to the ends. It works on the DOM, so controls a plug-in renders (the pen presets) take
 * part without wiring.
 *
 * In the options tier a slider or a select keeps Up/Down (and Home/End) for its value, as
 * in the APG toolbar pattern; Left/Right still move between controls. Keys a control has
 * claimed (`preventDefault`) are left alone, and so are all keys of a control marked
 * `data-keeps-arrows` (the lasso's move grip nudges with them).
 *
 * A radio group of the `ui/` primitives (swatches, a segmented control: Base UI radios, which
 * are not buttons) is one item, as the APG toolbar pattern asks: its chosen radio (else its
 * first) takes part, and the group's own arrows move within it. `ui/Slider` claims Left and
 * Right for its value, so Tab or Shift+Tab leaves it as in a native toolbar slider.
 */
import {
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
  useLayoutEffect,
  useRef,
} from 'react';

const ITEMS =
  'button:not([disabled]), input:not([disabled]):not([aria-hidden="true"]), select:not([disabled]), [role="radio"]:not(button):not([data-disabled])';

function isValueControl(element: Element | null): boolean {
  return (
    element instanceof HTMLSelectElement ||
    (element instanceof HTMLInputElement && element.type === 'range')
  );
}

/** The radio a group of primitive radios is represented by: the chosen one, else the first. */
function representsGroup(radio: HTMLElement): boolean {
  const group = radio.closest('[role="radiogroup"]');
  if (!group) return true;
  const radios = Array.from(
    group.querySelectorAll<HTMLElement>('[role="radio"]:not(button):not([data-disabled])'),
  );
  const chosen = radios.find((r) => r.getAttribute('aria-checked') === 'true') ?? radios[0];
  return chosen === radio;
}

function itemsOf(container: HTMLElement | null): HTMLElement[] {
  return Array.from(container?.querySelectorAll<HTMLElement>(ITEMS) ?? []).filter(
    (el) => el.tagName === 'BUTTON' || el.getAttribute('role') !== 'radio' || representsGroup(el),
  );
}

/**
 * Gives the Tab stop to the focused control, else the remembered one, else the first that
 * matches `preferred`, else the first; returns the chosen control.
 */
function applyRoving(
  container: HTMLElement | null,
  remembered: HTMLElement | null,
  preferred: string,
): HTMLElement | null {
  const list = itemsOf(container);
  if (list.length === 0) return remembered;
  const active = document.activeElement;
  const chosen =
    list.find((el) => el === active) ??
    (remembered && list.includes(remembered) ? remembered : undefined) ??
    (preferred === '' ? undefined : list.find((el) => el.matches(preferred))) ??
    list[0];
  for (const el of list) {
    // The attribute, not only the property: a button's tabIndex is 0 without one, and the
    // F6 regions find a region's Tab stop by `[tabindex="0"]`.
    const tabIndex = el === chosen ? '0' : '-1';
    if (el.getAttribute('tabindex') !== tabIndex) el.setAttribute('tabindex', tabIndex);
  }
  return chosen ?? null;
}

/**
 * @param preferred selector of the control that takes the Tab stop when the remembered one
 *   is gone (the armed tool, the group chip).
 */
export function useRovingTabindex(
  ref: RefObject<HTMLElement | null>,
  preferred = '',
  /**
   * When this changes (the armed tool), the remembered stop is forgotten, so the Tab stop and
   * F6 land on `preferred` again (03-markup MK-2 §8: the armed tool), unless focus is inside.
   */
  resetKey?: unknown,
) {
  const current = useRef<HTMLElement | null>(null);
  const lastKey = useRef(resetKey);

  // After every render, and whenever controls come and go inside (plug-ins, menus).
  useLayoutEffect(() => {
    if (lastKey.current !== resetKey) {
      lastKey.current = resetKey;
      current.current = null;
    }
    current.current = applyRoving(ref.current, current.current, preferred);
  });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new MutationObserver(() => {
      current.current = applyRoving(element, current.current, preferred);
    });
    observer.observe(element, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ref, preferred]);

  const onFocus = (event: FocusEvent<HTMLElement>) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.matches(ITEMS)) {
      current.current = applyRoving(ref.current, target, preferred);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const list = itemsOf(ref.current);
    const active = document.activeElement as HTMLElement | null;
    // Inside a group of primitive radios, the group is the item.
    const groupItem = list.find(
      (el) =>
        el.getAttribute('role') === 'radio' && el.closest('[role="radiogroup"]')?.contains(active),
    );
    const index = list.indexOf(
      active && list.includes(active) ? active : (groupItem ?? (active as HTMLElement)),
    );
    if (index < 0 || list[index]?.hasAttribute('data-keeps-arrows')) return;
    const valueControl = isValueControl(list[index] ?? null);
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % list.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + list.length) % list.length;
    else if (event.key === 'Home' && !valueControl) next = 0;
    else if (event.key === 'End' && !valueControl) next = list.length - 1;
    if (next === null) return;
    event.preventDefault();
    const target = list[next];
    if (!target) return;
    target.focus();
    current.current = applyRoving(ref.current, target, preferred);
  };

  return { onFocus, onKeyDown };
}
