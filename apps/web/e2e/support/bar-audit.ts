/**
 * The control-system audit (quality-bar.md Q-9; components/09-primitives.md §2.1; spec
 * redesign D0-3): in every bar, menu and popover a page shows, the controls share one height
 * (32 px on a fine pointer, 44 px on a coarse one), one centre line per row (within 0.5 px),
 * a radius from the set (the pill, or --radius-control's 10 px) and icon boxes of 16 or 20 px.
 *
 * Containers are `role="toolbar"`, `[data-bar]` (the title bar and dialog footers carry it),
 * `role="menu"` and the non-modal dialogs Base UI renders for popovers. A control is a button,
 * a link, a tab, a radio, a checkbox, a switch, a menu item, a combobox, a slider or a field.
 * What the audit reads, per control:
 *
 * - its box, or for a checkbox, radio or switch inside a `<label>`, the label's row (the box
 *   itself is a 16 or 20 px shape inside a control-high row, 09 §7–§9);
 * - a slider by its root (`[data-track]`, `ui/Slider`), whose height is its hit area;
 * - a control drawn wholly inside another (a tab's close button, a chip's ✕) is a part: its
 *   height and radius are its host's business, but its centre still shares the row;
 * - a link inside a paragraph is running text, sized by its line, and is left out;
 * - icons are the `svg` elements a control holds, except the drawings of the ink primitives
 *   (a slider's taper and notch, inside `[data-track]`) and the activity glyph, which is sized
 *   by the same tokens.
 */
import type { Page } from '@playwright/test';

/**
 * What kind of control a finding is about: `control` for the primitives and the ported chrome,
 * or one of the kinds that a later port replaces (native ranges, selects, fields and colour
 * inputs, the private swatch rows, menu rows), so a spec can hold those as pending by kind.
 */
export type ControlKind =
  | 'control'
  | 'menu row'
  | 'native range'
  | 'native select'
  | 'native field'
  | 'native colour'
  | 'private swatch';

export interface BarFinding {
  readonly state: string;
  readonly container: string;
  readonly kind: ControlKind;
  readonly problem: string;
}

export interface AuditOptions {
  /** The control height this density expects: 32 fine, 44 coarse. */
  readonly height: 32 | 44;
  /** Containers (by name) skipped, with the reason; the audit fails if one is not seen. */
  readonly skip?: Readonly<Record<string, string>>;
}

/** Runs the audit in the page and returns what is wrong, or nothing. */
export async function auditBars(
  page: Page,
  state: string,
  options: AuditOptions,
): Promise<{ findings: BarFinding[]; containers: string[] }> {
  const result = await page.evaluate(
    ({ height, skip }) => {
      // Popovers are the dialogs Base UI positions against an anchor (`data-side`); modal
      // dialogs are audited by their footers, which carry `data-bar`.
      const CONTAINER = '[role="toolbar"], [data-bar], [role="menu"], [role="dialog"][data-side]';
      const CONTROL = [
        'button',
        'a[href]',
        'input:not([type="hidden"])',
        'select',
        'textarea',
        '[role="button"]',
        '[role="tab"]',
        '[role="radio"]',
        '[role="checkbox"]',
        '[role="switch"]',
        '[role="menuitem"]',
        '[role="menuitemradio"]',
        '[role="menuitemcheckbox"]',
        '[role="combobox"]',
        '[role="slider"]',
      ].join(', ');
      const findings: { container: string; kind: string; problem: string }[] = [];
      const seen: string[] = [];

      const visible = (el: Element): boolean => {
        const box = el.getBoundingClientRect();
        if (box.width <= 1 || box.height <= 1) return false;
        if (box.bottom <= 0 || box.right <= 0) return false;
        if (box.top >= innerHeight || box.left >= innerWidth) return false;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        if (el.closest('[inert], [hidden], [aria-hidden="true"]')) return false;
        for (let node: Element | null = el; node; node = node.parentElement) {
          if (Number(getComputedStyle(node).opacity) === 0) return false;
        }
        return true;
      };

      const nameOf = (el: Element): string => {
        const label = el.getAttribute('aria-label');
        const bar = el.getAttribute('data-bar');
        const role = el.getAttribute('role') ?? el.tagName.toLowerCase();
        return label ? `${role} "${label}"` : bar ? `[data-bar="${bar}"]` : role;
      };

      const round = (v: number) => Math.round(v * 2) / 2;

      for (const container of document.querySelectorAll(CONTAINER)) {
        if (!visible(container)) continue;
        const name = nameOf(container);
        seen.push(name);
        if (skip[name] !== undefined) continue;

        const controls: { el: Element; box: DOMRect; row: boolean; part: boolean }[] = [];
        for (const el of container.querySelectorAll(CONTROL)) {
          if (el.closest(CONTAINER) !== container || !visible(el)) continue;
          // A link in running text (inside a paragraph) sizes with its line, not as a control.
          if (el.closest('p')) continue;
          const role = el.getAttribute('role');
          // Base UI's hidden form inputs sit beside the control they mirror.
          if (el instanceof HTMLInputElement && el.getAttribute('aria-hidden') === 'true') continue;
          let target: Element = el;
          let row = false;
          if (role === 'checkbox' || role === 'radio' || role === 'switch') {
            const label = el.closest('label');
            if (label && container.contains(label)) {
              target = label;
              row = true;
            }
          }
          if (role === 'slider' || (el instanceof HTMLInputElement && el.type === 'range')) {
            target = el.closest('[data-track]') ?? el;
            // ui/Slider's root is a layout row (label, track, readout): its height and centre
            // count, its corners do not (the track and knob draw the pill).
            row = target !== el;
          }
          if (controls.some((c) => c.el === target)) continue;
          controls.push({ el: target, box: target.getBoundingClientRect(), row, part: false });
        }
        // A control drawn wholly inside another is a part of it.
        for (const c of controls) {
          c.part = controls.some(
            (o) =>
              o !== c &&
              o.box.left <= c.box.left + 0.5 &&
              o.box.right >= c.box.right - 0.5 &&
              o.box.top <= c.box.top + 0.5 &&
              o.box.bottom >= c.box.bottom - 0.5 &&
              (o.box.width > c.box.width + 0.5 || o.box.height > c.box.height + 0.5),
          );
        }
        if (controls.length === 0) continue;

        const kindOf = (c: { el: Element }): string => {
          const el = c.el;
          const role = el.getAttribute('role') ?? '';
          if (role.startsWith('menuitem')) return 'menu row';
          if (el instanceof HTMLSelectElement) return 'native select';
          if (el instanceof HTMLInputElement) {
            if (el.type === 'range') return 'native range';
            if (el.type === 'color') return 'native colour';
            return 'native field';
          }
          if (el.querySelector('input[type="color"]')) return 'native colour';
          // Today's swatch rows are buttons; ui/Swatch is Base UI's radio, a span.
          if (el.tagName === 'BUTTON' && /swatch/i.test(el.getAttribute('class') ?? '')) {
            return 'private swatch';
          }
          return 'control';
        };
        const push = (c: { el: Element }, problem: string) =>
          findings.push({ container: name, kind: kindOf(c), problem });

        const describe = (c: { el: Element }) => {
          const el = c.el as HTMLElement;
          const label =
            el.getAttribute('aria-label') ??
            el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 24) ??
            '';
          return `${el.tagName.toLowerCase()}${label ? ` "${label}"` : ''}`;
        };

        // 1. One height per container, the density's.
        for (const c of controls) {
          if (c.part) continue;
          const h = round(c.box.height);
          if (Math.abs(h - height) > 0.5) push(c, `${describe(c)} is ${h} px high, not ${height}`);
        }

        // 2. One centre line per row of controls.
        const rows: {
          top: number;
          bottom: number;
          centres: { c: (typeof controls)[0]; y: number }[];
        }[] = [];
        for (const c of controls) {
          const y = c.box.top + c.box.height / 2;
          const row = rows.find((r) => y > r.top && y < r.bottom);
          if (row) row.centres.push({ c, y });
          else rows.push({ top: c.box.top, bottom: c.box.bottom, centres: [{ c, y }] });
        }
        for (const row of rows) {
          const ys = row.centres.map((e) => e.y);
          const spread = Math.max(...ys) - Math.min(...ys);
          if (spread > 0.5) {
            const first = row.centres[0];
            const off = row.centres.find((e) => Math.abs(e.y - (first?.y ?? 0)) > 0.5);
            push(
              off?.c ?? first?.c ?? { el: container },
              `centres differ by ${spread.toFixed(2)} px (${first ? describe(first.c) : ''} / ${off ? describe(off.c) : ''})`,
            );
          }
        }

        // 3. Radii: the pill or 10 px. A slider's root is its hit area, a box that draws
        // nothing: its track and knob are pills by construction (ui/Slider, 10-ink §3).
        for (const c of controls) {
          if (c.part || c.row || c.el.hasAttribute('data-track')) continue;
          const style = getComputedStyle(c.el);
          const min = Math.min(c.box.width, c.box.height);
          for (const corner of [
            style.borderTopLeftRadius,
            style.borderTopRightRadius,
            style.borderBottomRightRadius,
            style.borderBottomLeftRadius,
          ]) {
            const value = corner.endsWith('%')
              ? (Number.parseFloat(corner) / 100) * min
              : Number.parseFloat(corner);
            const pill = value >= min / 2 - 0.5;
            if (!pill && Math.abs(value - 10) > 0.5) {
              push(c, `${describe(c)} has radius ${corner}`);
              break;
            }
          }
        }

        // 4. Icon boxes of 16 or 20 px.
        for (const c of controls) {
          for (const svg of c.el.querySelectorAll('svg')) {
            if (svg.closest('[data-track]') || svg.hasAttribute('data-activity')) continue;
            if (!visible(svg)) continue;
            const box = svg.getBoundingClientRect();
            const w = round(box.width);
            const h = round(box.height);
            if (w !== h || (w !== 16 && w !== 20)) {
              push(c, `${describe(c)} has a ${w} × ${h} icon`);
            }
          }
        }
      }
      return { findings, seen };
    },
    { height: options.height, skip: options.skip ?? {} },
  );
  return {
    findings: result.findings.map((f) => ({ state, ...f, kind: f.kind as ControlKind })),
    containers: result.seen,
  };
}
