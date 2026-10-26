/**
 * In-page collectors, passed to page.evaluate as functions (they run in the browser, so they
 * use only DOM APIs and nothing from module scope).
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface RawSample {
  kind: 'text' | 'icon' | 'input-value' | 'placeholder';
  text: string;
  path: string;
  role: string;
  color: string | null;
  opacity: number;
  fontSize: number;
  weight: number;
  family: string;
  box: Box;
  tier: string | null;
  disabled: boolean;
  behind: boolean;
  covered: boolean;
}
export interface RawControl {
  kind: 'border' | 'selected' | 'glass' | 'disabled';
  path: string;
  role: string;
  label: string;
  box: Box;
  tier: string | null;
  radius: number;
}

export function collect(): { samples: RawSample[]; controls: RawControl[] } {
  const vw = innerWidth;
  const vh = innerHeight;
  const modals = [...document.querySelectorAll('[aria-modal="true"], dialog[open]')].filter((d) => {
    const r = d.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(d).visibility !== 'hidden';
  });
  const isPage = (el: Element) => !!el.closest('[role="region"][aria-label^="Page "]');
  const hiddenChain = (el: Element): number => {
    let o = 1;
    for (let e: Element | null = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      o *= parseFloat(cs.opacity);
    }
    return o;
  };
  const path = (el: Element): string => {
    const parts: string[] = [];
    for (
      let e: Element | null = el;
      e && e !== document.body && parts.length < 4;
      e = e.parentElement
    ) {
      let s = e.tagName.toLowerCase();
      if (e.id) s += '#' + e.id;
      const cls = [...e.classList].find(
        (c) => !/^(mat|s\d+|c\d+|cs|h\d+|r\d+)$/.test(c) && !c.startsWith('mat-'),
      );
      if (cls) s += '.' + cls.replace(/_[A-Za-z0-9-]{5,}$/, '');
      const d = [...e.attributes].find(
        (a) => a.name.startsWith('data-') && !a.name.startsWith('data-audit'),
      );
      if (d) s += `[${d.name}${d.value && d.value.length < 24 ? '="' + d.value + '"' : ''}]`;
      const al = e.getAttribute('aria-label');
      if (al && parts.length === 0) s += `[aria-label="${al.slice(0, 30)}"]`;
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  const roleOf = (el: Element): string => {
    const r = el.closest('button,a,[role],input,textarea,label,h1,h2,h3,h4,li,th,td,p');
    if (!r) return el.tagName.toLowerCase();
    return r.getAttribute('role') || r.tagName.toLowerCase();
  };
  const tier = (el: Element): string | null => {
    const m = el.closest('.mat');
    if (!m) return null;
    return [...m.classList].find((c) => /^mat-(chip|bar|panel|menu|sheet|lit)$/.test(c)) ?? 'mat';
  };
  const disabled = (el: Element) => !!el.closest('[disabled],[aria-disabled="true"]');
  const behind = (el: Element) =>
    !!el.closest('[inert]') || (modals.length > 0 && !modals.some((d) => d.contains(el)));
  /** Intersects with the viewport and every clipping ancestor. */
  const clip = (el: Element, r: { l: number; t: number; r: number; b: number }) => {
    let { l, t, r: rr, b } = r;
    l = Math.max(l, 0);
    t = Math.max(t, 0);
    rr = Math.min(rr, vw);
    b = Math.min(b, vh);
    for (let e: Element | null = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.clip && cs.clip !== 'auto' && cs.position === 'absolute')
        return { l: 0, t: 0, r: 0, b: 0 };
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.clipPath !== 'none') {
        const c = e.getBoundingClientRect();
        if (cs.overflowX !== 'visible') {
          l = Math.max(l, c.left);
          rr = Math.min(rr, c.right);
        }
        if (cs.overflowY !== 'visible') {
          t = Math.max(t, c.top);
          b = Math.min(b, c.bottom);
        }
      }
    }
    return { l, t, r: rr, b };
  };
  const covered = (el: Element, box: { x: number; y: number; w: number; h: number }) => {
    const hit = document.elementFromPoint(box.x + box.w / 2, box.y + box.h / 2);
    if (!hit) return true;
    if (hit === el || el.contains(hit) || hit.contains(el)) return false;
    // A sibling inside the same control (an icon beside a label) counts as the same place.
    const ctl = el.closest('button,a,[role],label,li');
    if (ctl && ctl.contains(hit)) return false;
    return true;
  };
  const samples: RawSample[] = [];
  const byEl = new Map<Element, { rects: DOMRect[]; text: string }>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent ?? '';
    if (!t.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('script,style,noscript,svg,title')) continue;
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
    if (!rects.length) continue;
    const e = byEl.get(el) ?? { rects: [], text: '' };
    e.rects.push(...rects);
    e.text += t.trim() + ' ';
    byEl.set(el, e);
  }
  for (const [el, { rects, text }] of byEl) {
    if (isPage(el)) continue;
    const op = hiddenChain(el);
    if (op < 0.02) continue;
    let l = Infinity,
      t = Infinity,
      r = -Infinity,
      b = -Infinity;
    for (const q of rects) {
      l = Math.min(l, q.left);
      t = Math.min(t, q.top);
      r = Math.max(r, q.right);
      b = Math.max(b, q.bottom);
    }
    const c = clip(el, { l, t, r, b });
    const box = { x: c.l, y: c.t, w: c.r - c.l, h: c.b - c.t };
    if (box.w < 3 || box.h < 3) continue;
    const cs = getComputedStyle(el);
    samples.push({
      kind: 'text',
      text: text.trim().slice(0, 48),
      path: path(el),
      role: roleOf(el),
      color:
        cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color
          ? cs.webkitTextFillColor
          : cs.color,
      opacity: op,
      fontSize: parseFloat(cs.fontSize),
      weight: parseFloat(cs.fontWeight),
      family: cs.fontFamily.split(',')[0].replace(/['"]/g, ''),
      box,
      tier: tier(el),
      disabled: disabled(el),
      behind: behind(el),
      covered: covered(el, box),
    });
  }
  // Field values and placeholders.
  const cv = document.createElement('canvas').getContext('2d')!;
  for (const el of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input:not([type]),input[type=text],input[type=search],input[type=email],input[type=number],input[type=url],input[type=tel],textarea',
  )) {
    if (isPage(el)) continue;
    const op = hiddenChain(el);
    if (op < 0.02) continue;
    const rr = el.getBoundingClientRect();
    if (rr.width < 8 || rr.height < 8) continue;
    const value = el.value;
    const ph = el.placeholder;
    if (!value && !ph) continue;
    const isPh = !value;
    const cs = getComputedStyle(el);
    const fcs = isPh ? getComputedStyle(el, '::placeholder') : cs;
    cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const txt = isPh ? ph : value;
    const pl = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
    const fs = parseFloat(cs.fontSize);
    const w = Math.min(cv.measureText(txt).width, rr.width - pl - 4);
    const x = cs.direction === 'rtl' ? rr.right - pl - w : rr.left + pl;
    const c = clip(el, {
      l: x,
      t: rr.top + rr.height / 2 - fs * 0.65,
      r: x + w,
      b: rr.top + rr.height / 2 + fs * 0.65,
    });
    const box = { x: c.l, y: c.t, w: c.r - c.l, h: c.b - c.t };
    if (box.w < 3 || box.h < 3) continue;
    samples.push({
      kind: isPh ? 'placeholder' : 'input-value',
      text: txt.slice(0, 48),
      path: path(el),
      role: el.getAttribute('role') || el.tagName.toLowerCase(),
      color: fcs.color,
      opacity: op,
      fontSize: fs,
      weight: parseFloat(cs.fontWeight),
      family: cs.fontFamily.split(',')[0].replace(/['"]/g, ''),
      box,
      tier: tier(el),
      disabled: disabled(el),
      behind: behind(el),
      covered: covered(el, box),
    });
  }
  // Icon glyphs: outermost SVGs of icon size.
  for (const svg of document.querySelectorAll('svg')) {
    if (svg.parentElement?.closest('svg')) continue;
    if (isPage(svg)) continue;
    const rr = svg.getBoundingClientRect();
    if (rr.width < 8 || rr.height < 8 || rr.width > 72 || rr.height > 72) continue;
    const op = hiddenChain(svg);
    if (op < 0.02) continue;
    const c = clip(svg, { l: rr.left, t: rr.top, r: rr.right, b: rr.bottom });
    const box = { x: c.l, y: c.t, w: c.r - c.l, h: c.b - c.t };
    if (box.w < 4 || box.h < 4) continue;
    const shape = svg.querySelector('path,circle,rect,line,polyline,polygon,ellipse,use,text');
    let color: string | null = getComputedStyle(svg).color;
    if (shape) {
      const s = getComputedStyle(shape);
      const stroked = s.stroke && s.stroke !== 'none' && parseFloat(s.strokeWidth) > 0;
      color = stroked ? s.stroke : s.fill;
      if (!color || color === 'none' || color.startsWith('url(')) color = null;
    }
    const host = svg.closest('button,a,[role]');
    samples.push({
      kind: 'icon',
      text: (host?.getAttribute('aria-label') ?? host?.textContent ?? '').trim().slice(0, 40),
      path: path(svg),
      role: roleOf(svg),
      color,
      opacity: op,
      fontSize: Math.max(rr.width, rr.height),
      weight: 0,
      family: '',
      box,
      tier: tier(svg),
      disabled: disabled(svg),
      behind: behind(svg),
      covered: covered(svg, box),
    });
  }
  // Non-text candidates.
  const controls: RawControl[] = [];
  const seen = new Set<Element>();
  const add = (el: Element, kind: RawControl['kind']) => {
    if (seen.has(el) && kind !== 'glass') return;
    if (isPage(el) || behind(el)) return;
    const rr = el.getBoundingClientRect();
    if (rr.width < 8 || rr.height < 8) return;
    if (rr.right < 0 || rr.bottom < 0 || rr.left > vw || rr.top > vh) return;
    if (hiddenChain(el) < 0.05) return;
    const c = clip(el, { l: rr.left, t: rr.top, r: rr.right, b: rr.bottom });
    if (c.r - c.l < rr.width * 0.9 || c.b - c.t < rr.height * 0.9) return;
    seen.add(el);
    controls.push({
      kind,
      path: path(el),
      role: el.getAttribute('role') || el.tagName.toLowerCase(),
      label: (el.getAttribute('aria-label') ?? (el as HTMLElement).innerText ?? '')
        .trim()
        .slice(0, 40),
      box: { x: rr.left, y: rr.top, w: rr.width, h: rr.height },
      tier: tier(el),
      radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0,
    });
  };
  document
    .querySelectorAll(
      '[aria-pressed="true"],[aria-selected="true"],[aria-checked="true"],[aria-current]:not([aria-current="false"]),[data-selected="true"],[data-selected=""]',
    )
    .forEach((el) => add(el, 'selected'));
  document
    .querySelectorAll('button:disabled,[aria-disabled="true"]')
    .forEach((el) => add(el, 'disabled'));
  document
    .querySelectorAll(
      'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]),textarea,[role=switch],[role=checkbox],input[type=checkbox],[role=radio],[role=slider],[role=searchbox],[role=combobox],select',
    )
    .forEach((el) => {
      // Inputs are often visually hidden inside a styled box: measure the visible box.
      const rr = el.getBoundingClientRect();
      if (rr.width < 8 || rr.height < 8) {
        const p = el.parentElement;
        if (p) add(p, 'border');
        return;
      }
      add(el, 'border');
    });
  document.querySelectorAll('.mat').forEach((el) => add(el, 'glass'));
  return { samples, controls };
}

/** Hides every text glyph and icon so the screenshot shows what sits behind them. */
export function hideInk(on: boolean): void {
  const id = 'audit-hide-ink';
  document.getElementById(id)?.remove();
  if (!on) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `*:not(svg *){color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important;text-decoration-color:transparent!important}
*::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important}
svg{visibility:hidden!important}*{transition:none!important}`;
  document.head.appendChild(s);
}

/** Draws boxes over failures (a fixed canvas overlay), labelled with their index. */
export function overlay(
  boxes: { x: number; y: number; w: number; h: number; label: string; tone: string }[],
): void {
  document.getElementById('audit-overlay')?.remove();
  if (!boxes.length) return;
  const c = document.createElement('canvas');
  c.id = 'audit-overlay';
  const dpr = devicePixelRatio;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  Object.assign(c.style, {
    position: 'fixed',
    inset: '0',
    width: innerWidth + 'px',
    height: innerHeight + 'px',
    zIndex: '2147483647',
    pointerEvents: 'none',
  });
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  g.font = '600 10px system-ui, sans-serif';
  for (const b of boxes) {
    g.strokeStyle = b.tone;
    g.lineWidth = 2;
    g.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    const tw = g.measureText(b.label).width + 6;
    g.fillStyle = b.tone;
    const ly = b.y - 15 < 0 ? b.y + b.h + 3 : b.y - 15;
    g.fillRect(b.x - 2, ly, tw, 12);
    g.fillStyle = '#fff';
    g.fillText(b.label, b.x + 1, ly + 10);
  }
  document.body.appendChild(c);
}

export async function settle(timeout: number): Promise<boolean> {
  const t0 = performance.now();
  const moving = () =>
    document
      .getAnimations()
      .some(
        (a) =>
          a.playState === 'running' &&
          Number.isFinite(a.effect?.getComputedTiming().endTime as number),
      );
  while (performance.now() - t0 < timeout) {
    let still = true;
    for (let i = 0; i < 3; i++) {
      if (moving()) {
        still = false;
        break;
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    if (still && !moving()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}
