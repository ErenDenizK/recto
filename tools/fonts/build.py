"""Cuts Recto's UI and signature faces (ADR-0027 §2.1–§2.2, language.md §4.1). Run by subset.sh.

Sources, all read from this repository's install (nothing is fetched):

- The variable Inter 4.001 (opsz 14–32, wght 100–900) of `@fontsource-variable/inter` 5.3.0,
  this package's pinned devDependency: its `latin` and `latin-ext` "standard" files are the
  Fontsource cut of upstream Inter with both axes.
- The static Inter 4.001 Regular and Bold the engine already bundles
  (`packages/engine/assets/fonts/`, ADR-0020 §5). Fontsource's cut drops the arrows, ↵, ⇥, ⇧
  and ≈ that the keycaps and the messages use; those are grafted in from the two statics,
  which are the variable font's own instances (Regular equals its default outline point for
  point, Bold its wght 700 instance within a unit), with their wght deltas rebuilt so they
  follow the weight like every other glyph.
- ⌃ is in neither; it is cut from the variable font's own ↑ (its head without the shaft, with
  every variation), so it matches the arrows at every weight and optical size.

Outputs, committed (ADR-0027 §3): `apps/web/public/fonts/inter-recto-latin.woff2` and
`inter-recto-latin-ext.woff2` ('Inter Recto', both axes, the features of §2.1),
`recto-signature-latin.woff2` and `recto-signature-latin-ext.woff2` (Inter's italic at 300, a
static cut for the typed signature, MK-13 §6), and the generated block of
`apps/web/src/styles/fonts.css`: the four @font-face rules with `unicode-range` read from each
file's cmap, and the metric-matched fallback faces (`size-adjust` and the ascent, descent and
line-gap overrides; quality-bar Q-8) measured against Arial's metrics.

What the Fontsource source cannot give: the `case`, `cv05`, `cv08`, `ss03` and `zero` features
(Fontsource strips them; the subsetter keeps them once the source is upstream `inter-ui`), and
the macOS modifier glyphs ⌘ ⌥ ⌫ ⌦, which no Inter on this machine carries; macOS's system face
draws those (they are shown only on macOS, `commands/shortcuts.ts`).
"""

from __future__ import annotations

import argparse
import copy
import json
import re
import sys
from collections import Counter
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import ttProgram
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphCoordinates
from fontTools.ttLib.tables.TupleVariation import TupleVariation
from fontTools.varLib.hvar import add_HVAR
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.varLib.models import normalizeValue, piecewiseLinearMap, supportScalar

ROOT = Path(__file__).resolve().parents[2]
FONTSOURCE = ROOT / 'tools/fonts/node_modules/@fontsource-variable/inter/files'
ENGINE_FONTS = ROOT / 'packages/engine/assets/fonts'
MESSAGES = [ROOT / 'apps/web/messages/en.json', ROOT / 'apps/web/messages/tr.json']
CSS = ROOT / 'apps/web/src/styles/fonts.css'
# Liberation Sans is metric-compatible with Arial (every advance width equal), so it stands in
# for Arial when measuring the fallback; any Debian or Ubuntu has it (fonts-liberation).
ARIAL_METRICS = {
    400: Path('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'),
    700: Path('/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'),
}

FAMILY = 'Inter Recto'
SIGNATURE_FAMILY = 'Recto Signature'
SIGNATURE_WEIGHT = 300  # annotations/stamps.ts TYPED_SIGNATURE_WEIGHT

# ADR-0027 §2.1: the OpenType features Recto uses; the rest are dropped.
FEATURES = ['kern', 'mark', 'mkmk', 'ccmp', 'locl', 'calt', 'case', 'tnum', 'pnum', 'frac',
            'cv05', 'cv08', 'ss03', 'zero']
SIGNATURE_FEATURES = ['kern', 'mark', 'mkmk', 'ccmp', 'locl', 'calt']


def span(first: int, last: int) -> list[int]:
    return list(range(first, last + 1))


# language.md §4.1 with 09-primitives §29: Latin-1, the Latin pieces English and Turkish share
# (ı, Œ œ), general punctuation, € ™ − ∕, the arrows, the keycaps (↵ ⇥ ⇧ ⌃; Issue 12) and the
# ≈ and ↔ the messages use. Fontsource's own latin range is kept (modifier letters, combining
# marks it carries, U+FEFF, U+FFFD) so nothing it covered falls back.
LATIN = sorted({
    *span(0x0000, 0x00FF), 0x0131, 0x0152, 0x0153, 0x02BB, 0x02BC, 0x02C6, 0x02DA, 0x02DC,
    0x0304, 0x0308, 0x0329, *span(0x2000, 0x206F), 0x20AC, 0x2122, 0x2212, 0x2215,
    *span(0x2190, 0x2199), 0x21A9, 0x21B5, 0x21E5, 0x21E7, 0x2248, 0x2303, 0xFEFF, 0xFFFD,
})
# Latin Extended-A less what Latin holds (Turkish ğ Ğ İ ş Ş and the rest of Europe), Romanian's
# comma-below letters and ₺.
LATIN_EXT = sorted({*span(0x0100, 0x017F), *span(0x0218, 0x021B), 0x20BA} - set(LATIN))
CONTROL_KEY = 0x2303


def load(path: Path) -> TTFont:
    font = TTFont(str(path), recalcTimestamp=False)
    font.ensureDecompiled()
    return font


def bold_peak(font: TTFont, weight: float) -> float:
    """Normalised wght coordinate (after avar) of `weight` in a variable font."""
    axis = next(a for a in font['fvar'].axes if a.axisTag == 'wght')
    value = normalizeValue(weight, (axis.minValue, axis.defaultValue, axis.maxValue))
    if 'avar' in font:
        value = piecewiseLinearMap(value, font['avar'].segments['wght'])
    return value


def outline(font: TTFont, name: str):
    glyf = font['glyf']
    coords, ends, flags = glyf[name].getCoordinates(glyf)
    return list(coords), list(ends), [f & 1 for f in flags]


def add_glyph(font: TTFont, name: str, glyph: Glyph, advance: int, codepoint: int,
              variations: list[TupleVariation]) -> None:
    glyf = font['glyf']
    glyf.glyphs[name] = glyph
    glyph.recalcBounds(glyf)
    font.setGlyphOrder([*font.getGlyphOrder(), name])
    glyf.glyphOrder = font.getGlyphOrder()
    font['hmtx'].metrics[name] = (advance, glyph.xMin if glyph.numberOfContours else 0)
    font['gvar'].variations[name] = variations
    for table in font['cmap'].tables:
        if table.isUnicode() and (codepoint <= 0xFFFF or table.format in (10, 12, 13)):
            table.cmap[codepoint] = name


def simple_glyph(coords, ends, flags) -> Glyph:
    glyph = Glyph()
    glyph.numberOfContours = len(ends)
    glyph.coordinates = GlyphCoordinates(coords)
    glyph.endPtsOfContours = ends
    glyph.flags = bytearray(flags)
    glyph.program = ttProgram.Program()
    glyph.program.fromBytecode(b'')
    return glyph


def graft_from_statics(var: TTFont, regular: TTFont, bold: TTFont, wanted: list[int]) -> list[str]:
    """Copies the code points `var` lacks from the Regular and Bold statics, with wght deltas.

    Inter interpolates linearly between its Regular and Black masters in normalised space, so a
    single region peaking at wght 900 reproduces it: delta = (Bold − Regular) / peak(700).
    """
    peak = bold_peak(var, 700)
    have = var.getBestCmap()
    regular_cmap, bold_cmap = regular.getBestCmap(), bold.getBestCmap()
    added = []
    for codepoint in wanted:
        if codepoint in have or codepoint not in regular_cmap or codepoint not in bold_cmap:
            continue
        source = regular_cmap[codepoint]
        name = source if source not in var['glyf'].glyphs else f'{source}.recto'
        coords, ends, flags = outline(regular, source)
        bold_coords, bold_ends, bold_flags = outline(bold, bold_cmap[codepoint])
        if (len(coords), ends, flags) != (len(bold_coords), bold_ends, bold_flags):
            raise SystemExit(f'U+{codepoint:04X}: Regular and Bold outlines are not compatible')
        advance = regular['hmtx'][source][0]
        bold_advance = bold['hmtx'][bold_cmap[codepoint]][0]
        deltas = [((bx - rx) / peak, (by - ry) / peak)
                  for (rx, ry), (bx, by) in zip(coords, bold_coords)]
        # Phantom points: origin, advance, top, bottom.
        deltas += [(0, 0), ((bold_advance - advance) / peak, 0), (0, 0), (0, 0)]
        variation = TupleVariation({'wght': (0.0, 1.0, 1.0)},
                                   [(round(dx), round(dy)) for dx, dy in deltas])
        add_glyph(var, name, simple_glyph(coords, ends, flags), advance, codepoint, [variation])
        added.append(f'U+{codepoint:04X}')
    return added


def intersect(a, b, c, d):
    """Where line ab meets line cd."""
    (x1, y1), (x2, y2), (x3, y3), (x4, y4) = a, b, c, d
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
    return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))


# ↑'s outline (Inter 4.001): 0 left wing tip, 1 apex, 2 right wing tip, 3 right wing's inner
# corner, 4 the right wing's inner edge where it bends into the shaft; 27 and 26 the same on
# the left. The head alone, closed at the meeting of the two inner edges, is ⌃.
ARROW_HEAD = (0, 1, 2, 3)
RIGHT_INNER, LEFT_INNER = (3, 4), (27, 26)


def add_control_key(var: TTFont) -> None:
    """⌃ (U+2303) cut from the variable font's own ↑: its head without the shaft, so it has the
    arrows' stroke, angle and placement at every weight and optical size.

    The five kept points keep their deltas; the new inner apex is solved per region the way
    varLib builds deltas (each region's delta is what the regions before it leave unexplained
    at its peak), so it lands exactly where the two inner edges meet at every master."""
    source = 'arrowup'
    coords, ends, flags = outline(var, source)
    tuples = copy.deepcopy(var['gvar'].variations[source])
    for tv in tuples:
        tv.calcInferredDeltas(coords, ends)
    tuples.sort(key=lambda tv: len(tv.axes))

    def points_at(location):
        scalars = [supportScalar(location, tv.axes) for tv in tuples]
        return [(x + sum(s * tv.coordinates[i][0] for s, tv in zip(scalars, tuples)),
                 y + sum(s * tv.coordinates[i][1] for s, tv in zip(scalars, tuples)))
                for i, (x, y) in enumerate(coords)]

    def apex(points):
        return intersect(points[RIGHT_INNER[0]], points[RIGHT_INNER[1]],
                         points[LEFT_INNER[0]], points[LEFT_INNER[1]])

    base = apex(coords)
    solved = []
    for tv in tuples:
        peak = {axis: support[1] for axis, support in tv.axes.items()}
        target = apex(points_at(peak))
        dx, dy = target[0] - base[0], target[1] - base[1]
        for earlier, delta in solved:
            scalar = supportScalar(peak, earlier.axes)
            dx, dy = dx - scalar * delta[0], dy - scalar * delta[1]
        solved.append((tv, (dx, dy)))

    keep = [*ARROW_HEAD]
    head = [coords[i] for i in keep]
    new_coords = [*head, (round(base[0]), round(base[1])), coords[LEFT_INNER[0]]]
    variations = []
    for tv, apex_delta in solved:
        deltas = [tv.coordinates[i] for i in keep]
        deltas += [apex_delta, tv.coordinates[LEFT_INNER[0]], *tv.coordinates[-4:]]
        variations.append(TupleVariation(tv.axes, [(round(x), round(y)) for x, y in deltas]))
    glyph = simple_glyph(new_coords, [len(new_coords) - 1], [1] * len(new_coords))
    add_glyph(var, 'uni2303', glyph, var['hmtx'][source][0], CONTROL_KEY, variations)


def rename(font: TTFont, family: str, style: str, postscript: str) -> None:
    """A private family name, so a locally installed Inter never stands in (ADR-0027 §2.1)."""
    table = font['name']
    version = table.getDebugName(5) or ''
    for name_id, value in {
        1: family, 2: style, 3: f'{version};{postscript}', 4: f'{family} {style}', 6: postscript,
        13: 'This Font Software is licensed under the SIL Open Font License, Version 1.1.',
        16: family, 17: style, 25: postscript.split('-')[0],
    }.items():
        table.removeNames(nameID=name_id)
        table.setName(value, name_id, 3, 1, 0x409)


def subset_to(font: TTFont, codepoints: list[int], features: list[str], out: Path) -> None:
    options = subset.Options()
    options.layout_features = features
    options.name_IDs = ['*']
    options.notdef_outline = True
    options.hinting = False
    options.glyph_names = False
    options.legacy_kern = False
    options.prune_unicode_ranges = True
    options.flavor = 'woff2'
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    font.flavor = 'woff2'
    out.parent.mkdir(parents=True, exist_ok=True)
    font.save(str(out))


def ui_face(source: str, codepoints: list[int], extra, out: Path) -> TTFont:
    font = load(FONTSOURCE / source)
    extra(font)
    if 'HVAR' in font:
        del font['HVAR']
    add_HVAR(font)  # advance deltas for every glyph, the grafted ones included
    rename(font, FAMILY, 'Regular', 'InterRecto-Regular')
    subset_to(font, codepoints, FEATURES, out)
    return load(out)


def signature_face(source: str, codepoints: list[int], out: Path) -> TTFont:
    font = instantiateVariableFont(load(FONTSOURCE / source), {'wght': SIGNATURE_WEIGHT})
    rename(font, SIGNATURE_FAMILY, 'Light Italic', 'RectoSignature-LightItalic')
    subset_to(font, codepoints, SIGNATURE_FEATURES, out)
    return load(out)


def unicode_range(font: TTFont) -> str:
    """The file's cmap as a `unicode-range`, so the browser asks this file only for what it has."""
    points = sorted(font.getBestCmap())
    ranges, start, prev = [], points[0], points[0]
    for point in points[1:] + [None]:
        if point is not None and point == prev + 1:
            prev = point
            continue
        ranges.append(f'U+{start:04X}' if start == prev else f'U+{start:04X}-{prev:04X}')
        if point is not None:
            start = prev = point
    return ', '.join(ranges)


def message_text() -> str:
    """Every string of the EN and TR catalogs, without the ICU placeholders."""
    parts = []

    def walk(value):
        if isinstance(value, str):
            parts.append(re.sub(r'\{[^{}]*\}', ' ', value))
        elif isinstance(value, dict):
            for key, item in value.items():
                if not key.startswith('$'):
                    walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    for path in MESSAGES:
        walk(json.loads(path.read_text(encoding='utf-8')))
    return ''.join(parts)


def average_advance(font: TTFont, weights: Counter) -> float:
    """Mean advance in em of the UI's text, each character weighted by its frequency."""
    cmap, hmtx, upm = font.getBestCmap(), font['hmtx'], font['head'].unitsPerEm
    total = count = 0
    for char, n in weights.items():
        name = cmap.get(ord(char))
        if name is None:
            continue
        total += hmtx[name][0] * n
        count += n
    return total / count / upm


def fallback_faces(latin: Path) -> list[dict]:
    """`size-adjust` scales Arial's advances to Inter's mean; the overrides then put Inter's
    ascent, descent and line gap on the scaled face (CSS Fonts 5 §4.11: they are divided by
    size-adjust because it scales them too). Measured for the UI's own characters at 400 and,
    for 600 and up, at 600 against Arial Bold."""
    weights = Counter(c for c in message_text() if not c.isspace() or c == ' ')
    faces = []
    for weight, arial_weight, css_weight, local in [
        (400, 400, '100 500', ['Arial', 'ArialMT', 'Liberation Sans', 'LiberationSans-Regular']),
        (600, 700, '600 900', ['Arial Bold', 'Arial-BoldMT', 'Liberation Sans Bold',
                               'LiberationSans-Bold']),
    ]:
        inter = load(latin)
        if weight != 400:
            inter = instantiateVariableFont(inter, {'wght': weight, 'opsz': 14})
        arial = load(ARIAL_METRICS[arial_weight])
        size_adjust = average_advance(inter, weights) / average_advance(arial, weights)
        upm, hhea = inter['head'].unitsPerEm, inter['hhea']
        faces.append({
            'weight': css_weight,
            'local': local,
            'size_adjust': size_adjust,
            'ascent': hhea.ascent / upm / size_adjust,
            'descent': -hhea.descent / upm / size_adjust,
            'line_gap': hhea.lineGap / upm / size_adjust,
        })
    return faces


def percent(value: float) -> str:
    return f'{value * 100:.4f}'.rstrip('0').rstrip('.') + '%'


def css_block(faces: dict[str, TTFont], fallbacks: list[dict]) -> str:
    lines = []
    for file, (family, style, weight) in {
        'inter-recto-latin-ext.woff2': (FAMILY, 'normal', '100 900'),
        'inter-recto-latin.woff2': (FAMILY, 'normal', '100 900'),
        'recto-signature-latin-ext.woff2': (SIGNATURE_FAMILY, 'italic', str(SIGNATURE_WEIGHT)),
        'recto-signature-latin.woff2': (SIGNATURE_FAMILY, 'italic', str(SIGNATURE_WEIGHT)),
    }.items():
        lines += [
            '@font-face {',
            f"  font-family: '{family}';",
            f'  font-style: {style};',
            f'  font-weight: {weight};',
            '  font-display: swap;',
            f"  src: url('/fonts/{file}') format('woff2');",
            f'  unicode-range: {unicode_range(faces[file])};',
            '}',
            '',
        ]
    for face in fallbacks:
        sources = ', '.join(f"local('{name}')" for name in face['local'])
        lines += [
            '@font-face {',
            f"  font-family: '{FAMILY} Fallback';",
            '  font-style: normal;',
            f"  font-weight: {face['weight']};",
            f'  src: {sources};',
            f"  size-adjust: {percent(face['size_adjust'])};",
            f"  ascent-override: {percent(face['ascent'])};",
            f"  descent-override: {percent(face['descent'])};",
            f"  line-gap-override: {percent(face['line_gap'])};",
            '}',
            '',
        ]
    return '\n'.join(lines).rstrip() + '\n'


BEGIN = '/* @generated by tools/fonts/subset.sh: begin (do not edit by hand) */\n'
END = '/* @generated by tools/fonts/subset.sh: end */\n'


def write_css(block: str) -> None:
    text = CSS.read_text(encoding='utf-8')
    start, end = text.index(BEGIN) + len(BEGIN), text.index(END)
    CSS.write_text(text[:start] + block + text[end:], encoding='utf-8')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--out', type=Path, default=ROOT / 'apps/web/public/fonts')
    parser.add_argument('--no-css', action='store_true', help='leave fonts.css untouched')
    args = parser.parse_args()

    regular = load(ENGINE_FONTS / 'Inter-Regular.ttf')
    bold = load(ENGINE_FONTS / 'Inter-Bold.ttf')
    grafted: list[str] = []

    def latin_extra(font: TTFont) -> None:
        grafted.extend(graft_from_statics(font, regular, bold, LATIN))
        add_control_key(font)

    def ext_extra(font: TTFont) -> None:
        grafted.extend(graft_from_statics(font, regular, bold, LATIN_EXT))

    faces = {
        'inter-recto-latin.woff2': ui_face('inter-latin-standard-normal.woff2', LATIN,
                                           latin_extra, args.out / 'inter-recto-latin.woff2'),
        'inter-recto-latin-ext.woff2': ui_face('inter-latin-ext-standard-normal.woff2',
                                               LATIN_EXT, ext_extra,
                                               args.out / 'inter-recto-latin-ext.woff2'),
        'recto-signature-latin.woff2': signature_face('inter-latin-wght-italic.woff2', LATIN,
                                                      args.out / 'recto-signature-latin.woff2'),
        'recto-signature-latin-ext.woff2': signature_face(
            'inter-latin-ext-wght-italic.woff2', LATIN_EXT,
            args.out / 'recto-signature-latin-ext.woff2'),
    }
    print('grafted from the statics:', ' '.join(grafted), file=sys.stderr)
    for file in faces:
        size = (args.out / file).stat().st_size
        print(f'{file}: {size} bytes ({size / 1024:.1f} KB)', file=sys.stderr)
    if not args.no_css:
        write_css(css_block(faces, fallback_faces(args.out / 'inter-recto-latin.woff2')))


if __name__ == '__main__':
    main()
