/**
 * The animation sweep of A-9 and A-10 (language.md §7.1, §7.5; ADR-0028 §2 item 1, §2.5;
 * research 22 §5.2; spec redesign D3-4): every animation the page starts is recorded the
 * moment it starts (CSS transitions and animations from their `transitionrun` and
 * `animationstart` events, Web Animations from `Element.prototype.animate`, View Transitions'
 * pseudo-elements once they are ready), so one that has already finished when the test looks is
 * still judged. Each record keeps its keyframes, timing and easing; the judges run in the page,
 * where `DOMMatrix` reads transforms.
 *
 * - **Reduced** (A-9): an animation may change only opacity and colour (any other property it
 *   names holds one value throughout, so `translateY(0px)` → `none` is not movement), and it
 *   interpolates for 150 ms at most; a stepped hold (a ring or a tint shown still, then removed)
 *   is not an interpolation. The one exemption is a progress indicator inside
 *   `role="progressbar"` or `aria-busy="true"` that animates opacity only with a period of at
 *   least 1.6 s (ADR-0028 §2.5).
 * - **Limits** (A-10): whatever moves (any property but opacity and colour) is within 1 % of its
 *   end by 500 ms, read on the easing (a `linear()` spring curve, or the motion core's sampled
 *   keyframes); a View Transition runs 250 ms at most; nothing but a progress indicator repeats
 *   forever.
 */
import type { Page } from '@playwright/test';

/** One recorded animation, as the page saw it start. */
export interface AnimationRecord {
  readonly target: string;
  readonly pseudo: string | null;
  readonly kind: string;
  readonly duration: number;
  readonly delay: number;
  readonly iterations: number;
  readonly easing: string;
  readonly frames: readonly Record<string, string | number | null>[];
  /** Inside a progress indicator (`role="progressbar"`, `aria-busy="true"`). */
  readonly progress: boolean;
}

/** Installs the recorder before the app loads; `startRecording` arms it. */
export async function installRecorder(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const rec = { on: false, items: [] as unknown[], viewTransitions: 0 };
    (window as unknown as { __motion: typeof rec }).__motion = rec;
    const seen = new WeakSet<Animation>();
    const label = (el: Element | null) => {
      if (!el) return '?';
      const id = el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? '';
      const cls = [...el.classList].slice(0, 2).join('.');
      return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}${id ? `[${id}]` : ''}`;
    };
    const note = (a: Animation) => {
      if (!rec.on || seen.has(a)) return;
      seen.add(a);
      const effect = a.effect as KeyframeEffect | null;
      if (!effect) return;
      const timing = effect.getComputedTiming();
      const target = effect.target;
      rec.items.push({
        target: label(target),
        pseudo: effect.pseudoElement,
        kind:
          a instanceof CSSTransition
            ? `transition ${a.transitionProperty}`
            : a instanceof CSSAnimation
              ? `animation ${a.animationName}`
              : 'script',
        duration: Number(timing.duration) || 0,
        delay: Number(timing.delay) || 0,
        iterations: Number(timing.iterations),
        easing: effect.getTiming().easing ?? 'linear',
        frames: effect.getKeyframes().map((k) => ({ ...k })),
        progress: Boolean(target?.closest('[role="progressbar"], [aria-busy="true"]')),
      });
    };
    const fromEvent = (event: Event) => {
      const el = event.target;
      if (el instanceof Element) for (const a of el.getAnimations()) note(a);
    };
    document.addEventListener('transitionrun', fromEvent, true);
    document.addEventListener('animationstart', fromEvent, true);
    const animate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate')
      ?.value as Element['animate'];
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
      const a = animate.apply(this, args);
      note(a);
      return a;
    };
    const start = document.startViewTransition?.bind(document);
    if (start) {
      document.startViewTransition = ((arg: Parameters<typeof start>[0]) => {
        const transition = start(arg);
        if (rec.on) rec.viewTransitions += 1;
        transition.ready.then(
          () => {
            for (const a of document.getAnimations()) {
              const pseudo = (a.effect as KeyframeEffect | null)?.pseudoElement ?? '';
              if (pseudo.startsWith('::view-transition')) note(a);
            }
          },
          () => undefined,
        );
        return transition;
      }) as typeof document.startViewTransition;
    }
  });
}

/** Clears what was recorded and records from now on. */
export async function startRecording(page: Page): Promise<void> {
  await page.evaluate(() => {
    const rec = (window as unknown as { __motion: { on: boolean; items: unknown[] } }).__motion;
    rec.items = [];
    rec.on = true;
  });
}

/** How many View Transitions started since recording began. */
export function viewTransitions(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __motion: { viewTransitions: number } }).__motion.viewTransitions,
  );
}

/** Stops recording; returns every animation that started since. */
export function recorded(page: Page): Promise<AnimationRecord[]> {
  return page.evaluate(() => {
    const rec = (window as unknown as { __motion: { on: boolean; items: AnimationRecord[] } })
      .__motion;
    rec.on = false;
    return rec.items;
  });
}

/**
 * Judges `records` in the page: `reduced` applies A-9's rule, otherwise A-10's limits. Returns
 * one line per violation.
 */
export function judge(
  page: Page,
  records: readonly AnimationRecord[],
  rule: 'reduced' | 'limits',
): Promise<string[]> {
  return page.evaluate(
    ({ records, rule }) => {
      const META = new Set(['offset', 'computedOffset', 'easing', 'composite']);
      /** Opacity and colour: what reduced motion may still change (A-9). */
      const still =
        /^(opacity|visibility|color|.*Color|background|backgroundImage|boxShadow|fill|stroke|filter|backdropFilter|webkitBackdropFilter|outlineStyle)$/;
      const matrix = (prop: string, value: string): number[] => {
        const v = value.trim();
        if (v === '' || v === 'none') return [1, 0, 0, 1, 0, 0];
        const css =
          prop === 'translate'
            ? `translate(${v.split(/\s+/).join(', ')})`
            : prop === 'scale'
              ? `scale(${v.split(/\s+/).join(', ')})`
              : prop === 'rotate'
                ? `rotate(${v})`
                : v;
        try {
          const m = new DOMMatrix(css);
          return [m.a, m.b, m.c, m.d, m.e, m.f];
        } catch {
          return [Number.NaN];
        }
      };
      const channels = (prop: string, value: unknown): number[] => {
        if (['transform', 'translate', 'scale', 'rotate'].includes(prop)) {
          return matrix(prop, String(value));
        }
        const n = Number.parseFloat(String(value));
        return Number.isNaN(n) ? [] : [n];
      };
      const same = (prop: string, a: unknown, b: unknown) => {
        if (String(a) === String(b)) return true;
        const x = channels(prop, a);
        const y = channels(prop, b);
        return (
          x.length > 0 &&
          x.length === y.length &&
          x.every((v, i) => Math.abs(v - (y[i] ?? 0)) < 1e-3)
        );
      };
      /** Properties whose value changes between keyframes. */
      const changing = (r: AnimationRecord) => {
        const props = new Set<string>();
        for (const f of r.frames) for (const k of Object.keys(f)) if (!META.has(k)) props.add(k);
        return [...props].filter((p) =>
          r.frames.some((f) => f[p] !== undefined && !same(p, f[p], r.frames[0]?.[p])),
        );
      };
      /** Whether every change between keyframes is a step (a hold), not an interpolation. */
      const stepped = (r: AnimationRecord) =>
        r.easing.startsWith('steps') ||
        r.frames.slice(0, -1).every((f, i) => {
          const next = r.frames[i + 1];
          const moves = Object.keys(f).some(
            (k) => !META.has(k) && next?.[k] !== undefined && !same(k, f[k], next[k]),
          );
          return !moves || String(f.easing ?? '').startsWith('steps');
        });
      /** Where a `linear()` curve last leaves the 1 % band around its end, 0–1. */
      const linearSettle = (easing: string): number => {
        const stops = easing
          .slice(7, -1)
          .split(',')
          .map((s) => s.trim().split(/\s+/));
        const points = stops.map(([v, at], i) => ({
          v: Number(v),
          at:
            at === undefined
              ? i === 0
                ? 0
                : i === stops.length - 1
                  ? 1
                  : Number.NaN
              : Number.parseFloat(at) / 100,
        }));
        let settle = 0;
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1]!;
          const b = points[i]!;
          if (Math.abs(a.v - 1) > 0.01) {
            // The crossing into the band inside this segment, or its end.
            const inside = Math.abs(b.v - 1) <= 0.01;
            const t =
              inside && b.v !== a.v ? (1 - Math.sign(1 - a.v) * 0.01 - a.v) / (b.v - a.v) : 1;
            settle = a.at + (b.at - a.at) * Math.min(1, Math.max(0, t));
          }
        }
        return settle;
      };
      /** When a moving animation is within 1 % of its end (A-10's 99 % settle), ms. */
      const settle = (r: AnimationRecord, props: string[]): number => {
        if (r.frames.length > 2) {
          const series = r.frames.map((f) => props.flatMap((p) => channels(p, f[p])));
          const last = series.at(-1) ?? [];
          let amp = 0;
          for (const s of series)
            for (const [j, v] of s.entries()) amp = Math.max(amp, Math.abs(v - (last[j] ?? 0)));
          if (amp === 0) return r.delay;
          let index = 0;
          for (const [i, s] of series.entries()) {
            if (s.some((v, j) => Math.abs(v - (last[j] ?? 0)) > 0.01 * amp)) index = i + 1;
          }
          const at = Number(r.frames[Math.min(index, r.frames.length - 1)]?.computedOffset ?? 1);
          return r.delay + r.duration * at;
        }
        const own = String(r.frames[0]?.easing ?? 'linear');
        const easing = own !== 'linear' ? own : r.easing;
        if (easing.startsWith('linear(')) return r.delay + r.duration * linearSettle(easing);
        if (easing === 'linear') return r.delay + r.duration * 0.99;
        return r.delay + r.duration;
      };
      const name = (r: AnimationRecord) =>
        `${r.kind} on ${r.target}${r.pseudo ?? ''} (${Math.round(r.duration)} ms)`;
      const out: string[] = [];
      for (const r of records) {
        const props = changing(r);
        const moving = props.filter((p) => !still.test(p));
        const forever = !Number.isFinite(r.iterations);
        const progressPulse =
          r.progress && props.every((p) => p === 'opacity') && r.duration >= 1600;
        if (rule === 'reduced') {
          if (moving.length) out.push(`${name(r)} moves ${moving.join(', ')}`);
          if (forever && !progressPulse) out.push(`${name(r)} repeats forever`);
          if (!forever && props.length && !stepped(r) && r.duration * r.iterations > 151) {
            out.push(`${name(r)} fades ${props.join(', ')} for over 150 ms`);
          }
        } else {
          if (forever && !r.progress) out.push(`${name(r)} repeats forever`);
          if (r.pseudo?.startsWith('::view-transition') && r.duration > 250) {
            out.push(`${name(r)}: a View Transition over 250 ms`);
          }
          if (moving.length && !forever) {
            const at = settle(r, moving);
            if (at > 505) out.push(`${name(r)} settles at ${Math.round(at)} ms`);
          }
        }
      }
      return out;
    },
    { records, rule },
  );
}
