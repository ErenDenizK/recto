// Visual gallery of the ink family (10-ink.md §3–§5): renders every part on dark glass over
// a page and on light glass, in fine and coarse density, and writes screenshots to
// apps/web/test-results/ink/. Not part of the suite: run on demand with INK_SHOTS.
import '../styles/fonts.css';
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { act, render } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import { it } from 'vitest';
import { cdp, page } from 'vitest/browser';

import { ColourPanel } from './colour/ColourPanel';
import { ColourWell } from './colour/ColourWell';
import { Eyedropper } from './colour/Eyedropper';
import { samplePagePixels } from '../viewer/page-pixels';
import { addSavedColour, noteRecentColour, reloadColourLists } from './colour/saved-colours';
import { Segmented } from './Segmented';
import { Slider } from './Slider';
import { NO_FILL, Swatch } from './Swatch';
import { SwatchGroup } from './SwatchGroup';

/** Chrome DevTools Protocol, typed loosely (the provider's session type is not exported). */
function devtools(method: string, params: object): Promise<unknown> {
  return (cdp() as unknown as { send(m: string, p: object): Promise<unknown> }).send(
    method,
    params,
  );
}

const INKS = ['#1A1A1A', '#1760EE', '#DB1C22', '#02853C', '#8036D3', '#E46910'];

function Glass({
  theme,
  zoom,
  children,
}: {
  theme: 'dark' | 'light';
  zoom: number;
  children: ReactNode;
}) {
  return (
    <div
      data-theme={theme}
      style={{
        zoom,
        position: 'relative',
        padding: 24,
        background:
          theme === 'dark'
            ? 'linear-gradient(90deg, #ffffff 0 45%, #08090b 45% 100%)'
            : 'linear-gradient(90deg, #e6e8eb 0 45%, #ffffff 45% 100%)',
      }}
    >
      <div
        className={theme === 'dark' ? 'glass glass-menu' : undefined}
        style={{
          padding: 16,
          borderRadius: 16,
          width: 'fit-content',
          ...(theme === 'light'
            ? {
                background: 'rgb(250 250 252 / 0.78)',
                backdropFilter: 'blur(24px) saturate(1.4) contrast(0.45) brightness(1.4)',
                boxShadow:
                  '0 16px 40px -12px rgb(21 23 28 / 0.25), inset 0 0 0 1px rgb(21 23 28 / 0.08)',
                color: '#15171c',
              }
            : {}),
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Controls() {
  const [a, setA] = useState(60);
  const [w, setW] = useState(1.5);
  const [ink, setInk] = useState<string>('#1760EE');
  const [view, setView] = useState<'grid' | 'spectrum' | 'sliders'>('grid');
  return (
    <div style={{ display: 'grid', gap: 12, width: 360 }}>
      <Slider label="Size" showLabel readout value={a} min={0} max={100} onValueChange={setA} />
      <div data-held="">
        <Slider label="Held" value={35} min={0} max={100} readout bubble="always" />
      </div>
      <Slider
        label="Hue"
        showLabel
        value={210}
        min={0}
        max={360}
        track="gradient"
        gradient="linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"
        knobColor="#0080ff"
        readout
        format={(v) => `${v}°`}
      />
      <Slider
        label="Opacity"
        showLabel
        value={60}
        min={0}
        max={100}
        track="gradient"
        checkerboard
        gradient="linear-gradient(to right, rgb(23 96 238 / 0), rgb(23 96 238))"
        knobColor="rgb(23 96 238 / 0.6)"
        readout
        format={(v) => `${v}%`}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <ColourWell value={ink} />
        <SwatchGroup label="Ink" value={ink} onValueChange={setInk}>
          {INKS.map((c) => (
            <Swatch key={c} value={c} tooltip={false} />
          ))}
        </SwatchGroup>
      </div>
      <SwatchGroup label="Fill" value={NO_FILL} onValueChange={() => undefined}>
        <Swatch value={NO_FILL} tooltip={false} />
        <Swatch value="#FFFFFF" tooltip={false} />
        <Swatch value="#FFEA00" tooltip={false} />
        <Swatch value="#8FD3FF" tooltip={false} />
      </SwatchGroup>
      <Slider
        label="Width"
        style={{ width: 220 }}
        value={w}
        min={0.25}
        max={24}
        scale="log"
        detents={[0.5, 1, 1.5, 2, 3, 5, 8, 12]}
        track="taper"
        knobColor="#1760EE"
        readout
        format={(v) => `${v} pt`}
        onValueChange={setW}
      />
      <Slider
        label="Width max"
        style={{ width: 220 }}
        value={24}
        min={0.25}
        max={24}
        scale="log"
        track="taper"
        knobColor="#DB1C22"
        readout
        format={(v) => `${v} pt`}
      />
      <Slider label="Disabled" showLabel readout value={30} min={0} max={100} disabled />
      <Segmented
        label="View"
        value={view}
        onValueChange={setView}
        options={[
          { value: 'grid', label: 'Grid' },
          { value: 'spectrum', label: 'Spectrum' },
          { value: 'sliders', label: 'Sliders' },
        ]}
      />
    </div>
  );
}

function Panel({ view }: { view: string }) {
  localStorage.setItem('pdf-editor:ui:colour-view:v1', JSON.stringify(view));
  const [c, setC] = useState('#1760EE');
  const [o, setO] = useState<number | undefined>(0.8);
  return (
    <div style={{ width: matchMedia('(pointer: coarse)').matches ? 336 : 296 }}>
      <ColourPanel
        value={c}
        opacity={o}
        onChange={(v, op) => {
          setC(v);
          setO(op);
        }}
        onClose={() => undefined}
        preview={{ width: 3, kind: 'pen' }}
      />
    </div>
  );
}

async function hold(container: HTMLElement) {
  const held = container.querySelectorAll<HTMLElement>('[data-held] [data-slider-thumb]');
  for (const thumb of held) {
    const r = thumb.getBoundingClientRect();
    act(() => {
      thumb.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          clientX: r.left + r.width / 2,
          clientY: r.top + r.height / 2,
          pointerId: 0,
          pointerType: 'mouse',
          button: 0,
          buttons: 1,
        }),
      );
    });
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
}

for (const density of ['fine', 'coarse'] as const) {
  it.skipIf(import.meta.env.VITE_INK_SHOTS !== '1')(
    `ink gallery, ${density}`,
    { timeout: 60_000 },
    async () => {
      const scale = Number(import.meta.env.VITE_INK_DPR ?? '1');
      await page.viewport(1440 * scale, 1700 * scale);
      await devtools('Emulation.setTouchEmulationEnabled', {
        enabled: density === 'coarse',
        maxTouchPoints: 5,
      });
      try {
        reloadColourLists();
        addSavedColour('#123C9A');
        addSavedColour('#E0201E');
        addSavedColour('#FFE81A');
        noteRecentColour('#0E8080');
        noteRecentColour('#7A34C8');
        reloadColourLists();
        for (const theme of ['dark', 'light'] as const) {
          const { container, unmount } = render(
            <Glass theme={theme} zoom={scale}>
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                <Controls />
                <Panel view="grid" />
                <Panel view="spectrum" />
                <Panel view="sliders" />
              </div>
            </Glass>,
          );
          await hold(container);
          await new Promise((resolve) => setTimeout(resolve, 400));
          await page.screenshot({
            path: `../../test-results/ink/gallery-${theme}-${density}${scale === 1 ? '' : `@${scale}x`}.png`,
            element: container.firstElementChild as HTMLElement,
          });
          unmount();
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        }
      } finally {
        await devtools('Emulation.setTouchEmulationEnabled', { enabled: false });
      }
    },
  );
}

it.skipIf(import.meta.env.VITE_INK_SHOTS !== '1')('eyedropper loupe over a page', async () => {
  await page.viewport(600, 400);
  const { unmount } = render(
    <div
      data-page-id="p"
      style={{ position: 'fixed', left: 40, top: 40, width: 400, height: 300, background: '#fff' }}
    >
      <canvas
        data-state="rendered"
        width={400}
        height={300}
        style={{ position: 'absolute', inset: 0 }}
        ref={(canvas) => {
          const c = canvas?.getContext('2d');
          if (!c) return;
          c.fillStyle = '#fff';
          c.fillRect(0, 0, 400, 300);
          c.fillStyle = '#1A1A1A';
          c.font = '28px serif';
          c.fillText('Recto page text', 40, 120);
          c.fillStyle = '#1760EE';
          c.fillRect(200, 160, 120, 60);
        }}
      />
    </div>,
  );
  render(
    <Eyedropper
      sample={samplePagePixels}
      onPick={() => undefined}
      onCancel={() => undefined}
      start={{ x: 240, y: 200 }}
    />,
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  await page.screenshot({ path: '../../test-results/ink/eyedropper.png' });
  unmount();
});
