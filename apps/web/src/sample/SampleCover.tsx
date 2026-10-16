/**
 * The sample's first page, the cover both cuts share (`public/sample/recto-sample-*.pdf`,
 * tools/fixtures/sample/pages/cover.ts; MOB-11, MOB-14), drawn in its own proportions from
 * the page's coordinates: the night sky over a dark sea, the masthead lit by the lamp, the
 * lime issue line, the beam leaving the lamp by the spine (the aurora ramp, lemon to mint),
 * the lamp's halo, the three cover lines, the dark try slip and the fore-edge lamp tab. It is
 * content, so it keeps the page's own colours in both themes (ADR-0023 §2.1), as a Library
 * card's thumbnail does. Static, so a Library that shows it loads no engine before a file is
 * chosen; the phone's sample card (`CompactLibrary`) and the full Library's (`SampleCard`)
 * draw it.
 */
import { useId } from 'react';

const LIME = '#c8fb3d';
const PAPER = '#f4f5f7';
const SEA = [186, 192, 199, 207, 216, 227, 240, 255, 271];

export function SampleCover({ className }: { readonly className?: string | undefined }) {
  const id = useId();
  const ref = (name: string) => `url(#${id}-${name})`;
  return (
    <svg className={className} viewBox="0 0 210 297" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0b0c0e" />
          <stop offset="0.55" stopColor="#0e1014" />
          <stop offset="1" stopColor="#151a21" />
        </linearGradient>
        <radialGradient id={`${id}-dusk`} cx="0" cy="1" r="1" gradientTransform="scale(1 0.4)">
          <stop offset="0" stopColor="#1f9996" stopOpacity="0.3" />
          <stop offset="1" stopColor="#1f9996" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-beam`} x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" stopColor="#fbffe0" />
          <stop offset="0.3" stopColor="#cbff5f" />
          <stop offset="1" stopColor="#69eaa3" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.12" stopColor="#f6fcc4" />
          <stop offset="0.4" stopColor={LIME} stopOpacity="0.35" />
          <stop offset="1" stopColor={LIME} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-type`} cx="163" cy="158" r="226" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fffff4" />
          <stop offset="0.62" stopColor="#e1e4e8" />
          <stop offset="1" stopColor="#a7adb6" />
        </radialGradient>
      </defs>
      <rect width="210" height="179" fill={ref('sky')} />
      <rect width="210" height="179" fill={ref('dusk')} />
      <rect y="179" width="210" height="118" fill="#07080b" />
      <polygon points="163,158 0,138 0,152" fill={ref('beam')} opacity="0.3" />
      <polygon points="163,158 0,143 0,147" fill={ref('beam')} />
      {SEA.map((y) => (
        <rect key={`s${y}`} x="0" y={y} width="210" height="0.5" fill="#1a1f27" />
      ))}
      <polygon points="138,179 160,172 175,172 210,176 210,181 138,180" fill="#050608" />
      <polygon points="160.5,172 165.5,172 164.5,161 161.5,161" fill="#20262d" />
      <circle cx="163" cy="158" r="16" fill={ref('halo')} />
      <rect x="18" y="16" width="56" height="2.5" rx="1.25" fill={PAPER} opacity="0.4" />
      <rect x="19" y="31" width="171" height="38" rx="3" fill={ref('type')} />
      <rect x="20" y="78" width="60" height="3" rx="1.5" fill={LIME} />
      {[0, 1, 2].map((i) => (
        <g key={`c${i}`}>
          <rect x="20" y={204 + i * 25} width="7" height="8" rx="1" fill={LIME} />
          <rect x="33" y={204 + i * 25} width={[86, 46, 52][i]} height="4" rx="2" fill={PAPER} />
          <rect
            x="33"
            y={211 + i * 25}
            width={[64, 78, 44][i]}
            height="2.5"
            rx="1.25"
            fill={PAPER}
            opacity="0.45"
          />
        </g>
      ))}
      <rect x="20" y="275" width="170" height="10" rx="2" fill="#16181d" />
      <circle cx="25" cy="280" r="1.3" fill={LIME} />
      <rect x="206.8" y="13" width="3.2" height="23" rx="1" fill="#151a21" />
      <rect x="208" y="16" width="0.6" height="17" fill="#edfa6d" />
    </svg>
  );
}
