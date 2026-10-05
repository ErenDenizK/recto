/**
 * The target audit (A-15; research 22 §13; WCAG 2.5.8; components/07-sheets.md §8,
 * 08-feedback.md FB4 §8): inside a floating surface, every visible target is at least 24 × 24 px
 * with a fine pointer, or spaced so a 24 px circle on its centre touches no other target's
 * circle (2.5.8's spacing exception), and at least 44 × 44 px under a coarse pointer, where
 * there is no exception. Hit areas never overlap.
 *
 * What a target is, as the bar audit reads controls (e2e/support/bar-audit.ts): a checkbox,
 * radio or switch inside its `<label>` is the label's row; a segment of `ui/Segmented` is its
 * track's height across its own width; a slider is its root (`[data-track]`); a text field is
 * its well, which the input fills inside a 1 px border; a link inside a
 * paragraph is running text (2.5.8's inline exception); a control drawn wholly inside another
 * (a chip's ✕) is part of it and only must not overlap its siblings. Inputs Base UI keeps for
 * assistive technology (aria-hidden, or clipped away) are not targets.
 */
import type { Locator } from '@playwright/test';

export interface TargetFinding {
  readonly target: string;
  readonly problem: string;
}

/**
 * Audits the targets inside `surface` for a pointer of `min` px (24 fine, 44 coarse): how many
 * it measured, and what is wrong.
 */
export function auditTargets(
  surface: Locator,
  min: 24 | 44,
): Promise<{ readonly count: number; readonly findings: TargetFinding[] }> {
  return surface.evaluate((root, min) => {
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
      '[role="option"]',
      '[role="slider"]',
    ].join(', ');
    const visible = (el: Element): boolean => {
      const box = el.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) return false;
      if (el.closest('[inert], [hidden], [aria-hidden="true"]')) return false;
      if (getComputedStyle(el).clipPath === 'inset(50%)') return false;
      return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    };
    const nameOf = (el: Element): string => {
      const label =
        el.getAttribute('aria-label') ??
        el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 24) ??
        '';
      return `${el.getAttribute('role') ?? el.tagName.toLowerCase()}${label ? ` "${label}"` : ''}`;
    };

    interface Target {
      readonly el: Element;
      readonly name: string;
      readonly box: DOMRect;
      part: boolean;
    }
    const targets: Target[] = [];
    for (const el of root.querySelectorAll(CONTROL)) {
      if (!visible(el) || el.closest('p')) continue;
      const role = el.getAttribute('role');
      let target: Element = el;
      let box = el.getBoundingClientRect();
      if (role === 'checkbox' || role === 'radio' || role === 'switch') {
        const label = el.closest('label');
        if (label && root.contains(label)) {
          target = label;
          box = label.getBoundingClientRect();
        }
      }
      if ((role === 'radio' || role === 'tab') && el.hasAttribute('data-segment')) {
        const track = el.closest('[role="radiogroup"], [role="tablist"]');
        if (track) {
          const t = track.getBoundingClientRect();
          box = new DOMRect(box.x, t.y, box.width, t.height);
        }
      }
      if (role === 'slider') {
        target = el.closest('[data-track]') ?? el;
        box = target.getBoundingClientRect();
      }
      // A text field is its well (09-primitives §12): the input fills the well inside its
      // 1 px border, and the well is the 32 / 44 px control.
      const well = el.parentElement;
      if (
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
        well?.tagName === 'DIV' &&
        well.getBoundingClientRect().height <= box.height + 4
      ) {
        box = well.getBoundingClientRect();
      }
      if (targets.some((t) => t.el === target)) continue;
      targets.push({ el: target, name: nameOf(el), box, part: false });
    }
    const inside = (a: DOMRect, b: DOMRect) =>
      b.left <= a.left + 0.5 &&
      b.right >= a.right - 0.5 &&
      b.top <= a.top + 0.5 &&
      b.bottom >= a.bottom - 0.5;
    for (const t of targets) {
      t.part = targets.some((o) => o !== t && inside(t.box, o.box) && o.el.contains(t.el));
    }

    const findings: { target: string; problem: string }[] = [];
    const size = (b: DOMRect) => `${b.width.toFixed(1)} × ${b.height.toFixed(1)}`;
    for (const t of targets) {
      if (t.part) continue;
      if (t.box.width >= min - 0.5 && t.box.height >= min - 0.5) continue;
      if (min === 24) {
        // 2.5.8's spacing: a 24 px circle on its centre clear of every other target's.
        const cx = t.box.left + t.box.width / 2;
        const cy = t.box.top + t.box.height / 2;
        const clash = targets.find((o) => {
          if (o === t || o.part) return false;
          const ox = Math.max(o.box.left, Math.min(cx, o.box.right));
          const oy = Math.max(o.box.top, Math.min(cy, o.box.bottom));
          return Math.hypot(ox - cx, oy - cy) < 24;
        });
        if (!clash) continue;
        findings.push({
          target: t.name,
          problem: `${size(t.box)} px and within 24 px of ${clash.name}`,
        });
        continue;
      }
      findings.push({ target: t.name, problem: `${size(t.box)} px, under ${min} × ${min}` });
    }
    // Hit areas never overlap (a part may sit inside its host, never across a sibling).
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        const a = targets[i];
        const b = targets[j];
        if (!a || !b || a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const w = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
        const h = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
        if (w > 0.5 && h > 0.5) {
          findings.push({
            target: a.name,
            problem: `overlaps ${b.name} by ${size(new DOMRect(0, 0, w, h))} px`,
          });
        }
      }
    }
    return { count: targets.length, findings };
  }, min);
}
