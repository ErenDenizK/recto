#!/bin/sh
# Cuts Recto's faces (ADR-0027 §2.1, language.md §4.1, 09-primitives §29): the two 'Inter Recto'
# files and the typed signature's two files into apps/web/public/fonts/, the generated block of
# apps/web/src/styles/fonts.css, and SHA256SUMS. Everything it reads is already in the repository
# or its install (build.py names the sources); nothing is fetched, and the build and the tests
# never run it: they use the committed outputs.
#
#   pnpm --filter @pdf-editor/fonts-tool subset          # rewrite the outputs
#   pnpm --filter @pdf-editor/fonts-tool subset --check  # cut into a temporary directory and
#                                                        # compare with SHA256SUMS
#
# Needs Python 3 with the pinned fontTools and brotli (requirements.txt), e.g.
#   python3 -m venv .venv && .venv/bin/pip install -r tools/fonts/requirements.txt
#   PYTHON=.venv/bin/python pnpm --filter @pdf-editor/fonts-tool subset
# and the Liberation Sans files (fonts-liberation) for the fallback metrics.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
python=${PYTHON:-python3}
fonts="$root/apps/web/public/fonts"
files="inter-recto-latin.woff2 inter-recto-latin-ext.woff2 recto-signature-latin.woff2 recto-signature-latin-ext.woff2"

"$python" - "$here/requirements.txt" <<'EOF'
import sys
from importlib.metadata import PackageNotFoundError, version

missing = []
for line in open(sys.argv[1], encoding='utf-8'):
    line = line.split('#')[0].strip()
    if not line:
        continue
    name, wanted = line.split('==')
    try:
        found = version(name)
    except PackageNotFoundError:
        found = None
    if found != wanted:
        missing.append(f'{name}=={wanted} (found {found})')
if missing:
    sys.exit('tools/fonts needs ' + ', '.join(missing) + '; pip install -r tools/fonts/requirements.txt')
EOF

sums() {
  (cd "$1" && sha256sum $files)
}

if [ "${1:-}" = "--check" ]; then
  out=$(mktemp -d)
  trap 'rm -rf "$out"' EXIT
  "$python" "$here/build.py" --out "$out" --no-css
  if sums "$out" | diff -u "$here/SHA256SUMS" -; then
    echo "fonts: the committed files match a fresh cut"
  else
    echo "fonts: the committed files differ from a fresh cut; run tools/fonts/subset.sh" >&2
    exit 1
  fi
  exit 0
fi

"$python" "$here/build.py" --out "$fonts"
(cd "$root" && pnpm exec biome format --write apps/web/src/styles/fonts.css >/dev/null)
sums "$fonts" > "$here/SHA256SUMS"
echo "fonts: wrote $(echo $files | wc -w) files, fonts.css and SHA256SUMS"
