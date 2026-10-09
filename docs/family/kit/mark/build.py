"""Draw the maker's mark `edk.` as outlines (family kit, mark/README.md).

Input: the site's own Newsreader subset (src/fonts/newsreader-latin.woff2, OFL-1.1). Output: SVGs
in this folder that need no font. The letters are Newsreader at weight 500 with the bar's tracking
(-0.01 em, src/styles/global.css `.mark`) and the face's own kerning; the dot is not the period
glyph but the site's dot (`.mark .dot`: a circle 0.22 em across, 0.07 em after the k, resting on
the baseline), kept as its own path so it can take each product's colour.

Two optical cuts, because Newsreader has an optical-size axis and the mark is used from 14 px to
a press poster: `text` (opsz 26, exactly what the bar draws at 26 px) for anything set under 48 px,
`display` (opsz 72) from 48 px up.

  pip install fonttools brotli skia-pathops
  python3 docs/family-kit/mark/build.py

Deterministic: same font, same bytes.
"""
import os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.recordingPen import RecordingPen
import pathops

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
FONT = os.path.join(ROOT, 'src', 'fonts', 'newsreader-latin.woff2')

TEXT = 'edk'
WEIGHT = 500
TRACKING = -0.01      # em, after every letter (CSS letter-spacing)
DOT_D = 0.22          # em, the dot's diameter
DOT_GAP = 0.07        # em, from the k's advance (after tracking) to the dot
CUTS = {'text': 26, 'display': 72}

# Colours (README "Colour"). Ink: the house ink on dark, the house ground on light. The dot's
# default is edk's own light #c9d4ff (13.5:1 on #0a0a0b); on light grounds a deeper blue of the
# same hue, solved with light.js: solveInk('#f6f4f0', { hue: 274, chroma: 0.155, target: 4.5 })
# = #5967cc (4.51:1 on #f6f4f0, 4.96:1 on white; WCAG 1.4.11 asks 3:1 of a graphic).
INK_ON_DARK, DOT_ON_DARK = '#e9e5de', '#c9d4ff'
INK_ON_LIGHT, DOT_ON_LIGHT = '#0a0a0b', '#5967cc'


def kern(font, left, right):
    """Pair adjustment (x advance, font units) from the GPOS `kern` lookups, formats 1 and 2."""
    gpos = font['GPOS'].table
    total = 0
    for fr in gpos.FeatureList.FeatureRecord:
        if fr.FeatureTag != 'kern':
            continue
        for li in fr.Feature.LookupListIndex:
            lookup = gpos.LookupList.Lookup[li]
            for st in lookup.SubTable:
                if lookup.LookupType == 9:
                    st = st.ExtSubTable
                if not hasattr(st, 'Format') or not hasattr(st, 'Coverage') or (
                        st.Format == 1 and not hasattr(st, 'PairSet')) or (
                        st.Format == 2 and not hasattr(st, 'Class1Record')):
                    continue  # not a pair-positioning subtable
                cov = st.Coverage.glyphs
                if left not in cov:
                    continue
                if st.Format == 1:
                    ps = st.PairSet[cov.index(left)]
                    for rec in ps.PairValueRecord:
                        if rec.SecondGlyph == right and rec.Value1 is not None:
                            total += getattr(rec.Value1, 'XAdvance', 0) or 0
                elif st.Format == 2:
                    c1 = st.ClassDef1.classDefs.get(left, 0)
                    c2 = st.ClassDef2.classDefs.get(right, 0)
                    v = st.Class1Record[c1].Class2Record[c2].Value1
                    if v is not None:
                        total += getattr(v, 'XAdvance', 0) or 0
                break  # first subtable that covers the pair wins, as in shaping
    return total


def outline(font, opsz):
    inst = instancer.instantiateVariableFont(font, {'wght': WEIGHT, 'opsz': opsz}, inplace=False)
    upem = inst['head'].unitsPerEm
    gs = inst.getGlyphSet()
    cmap = inst.getBestCmap()
    names = [cmap[ord(c)] for c in TEXT]
    track = TRACKING * upem
    x = 0.0
    letters = pathops.Path()
    for i, name in enumerate(names):
        rec = RecordingPen()
        gs[name].draw(TransformPen(rec, (1, 0, 0, 1, x, 0)))
        p = pathops.Path()
        rec.replay(p.getPen())
        letters = pathops.op(letters, p, pathops.PathOp.UNION)
        x += gs[name].width + track
        if i + 1 < len(names):
            x += kern(inst, name, names[i + 1])
    r = DOT_D * upem / 2
    cx = x + DOT_GAP * upem + r
    return letters, (cx, r, r), upem


def svg_path(path):
    """Path data with y flipped (font y-up to SVG y-down), integer font units."""
    pen = SVGPathPen(None, ntos=lambda v: str(int(round(v))) if abs(v - round(v)) < 1e-6 else f'{v:.1f}')
    flip = TransformPen(pen, (1, 0, 0, -1, 0, 0))
    rounded = RecordingPen()
    path.draw(rounded)
    rounded.replay(flip)
    return pen.getCommands()


def circle_d(cx, cy, r):
    cy = -cy
    k = 0.5522847498 * r  # four cubic quarter arcs, so every tool (and SwiftUI's SVG import) reads it
    f = lambda v: f'{v:.1f}'.rstrip('0').rstrip('.')
    return (f'M{f(cx + r)} {f(cy)}'
            f'C{f(cx + r)} {f(cy + k)} {f(cx + k)} {f(cy + r)} {f(cx)} {f(cy + r)}'
            f'C{f(cx - k)} {f(cy + r)} {f(cx - r)} {f(cy + k)} {f(cx - r)} {f(cy)}'
            f'C{f(cx - r)} {f(cy - k)} {f(cx - k)} {f(cy - r)} {f(cx)} {f(cy - r)}'
            f'C{f(cx + k)} {f(cy - r)} {f(cx + r)} {f(cy - k)} {f(cx + r)} {f(cy)}Z')


def main():
    font = TTFont(FONT)
    report = []
    for cut, opsz in CUTS.items():
        letters, (cx, cy, r), upem = outline(font, opsz)
        x0, y0, x1, y1 = letters.bounds
        x1 = max(x1, cx + r)
        y0 = min(y0, 0)
        # viewBox: tight to the ink; the baseline is y = 0, so the box starts at -y1
        vb = f'{int(x0 // 1)} {int(-y1 // 1)} {int(-(-(x1 - x0) // 1))} {int(-(-(y1 - y0) // 1))}'
        w = int(-(-(x1 - x0) // 1))
        h = int(-(-(y1 - y0) // 1))
        dl = svg_path(letters)
        dd = circle_d(cx, cy, r)

        def doc(body, title='edk.'):
            return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w / upem * 100:.2f}" '
                    f'height="{h / upem * 100:.2f}" role="img" aria-label="{title}">'
                    f'<title>{title}</title>{body}</svg>\n')

        suffix = '' if cut == 'text' else '-display'
        files = {
            f'edk-on-dark{suffix}.svg': doc(f'<path fill="{INK_ON_DARK}" d="{dl}"/><path fill="{DOT_ON_DARK}" d="{dd}"/>'),
            f'edk-on-light{suffix}.svg': doc(f'<path fill="{INK_ON_LIGHT}" d="{dl}"/><path fill="{DOT_ON_LIGHT}" d="{dd}"/>'),
            # inline use: the letters follow currentColor, the dot a custom property (README "Web")
            f'edk-inline{suffix}.svg': doc(
                f'<path class="edk-letters" fill="currentColor" d="{dl}"/>'
                f'<path class="edk-dot" style="fill:var(--edk-dot,currentColor)" d="{dd}"/>'),
            # SwiftUI / asset catalogues: two template images on one viewBox, layered (README "SwiftUI")
            f'edk-letters{suffix}.svg': doc(f'<path d="{dl}"/>', 'edk'),
            f'edk-dot{suffix}.svg': doc(f'<path d="{dd}"/>', '.'),
        }
        for name, body in files.items():
            with open(os.path.join(HERE, name), 'w') as fh:
                fh.write(body)
        report.append(f'{cut:8} opsz {opsz:2}  viewBox {vb}  (em {upem}; ink {w / upem:.3f} x {h / upem:.3f} em)')
    print('\n'.join(report))


if __name__ == '__main__':
    main()
