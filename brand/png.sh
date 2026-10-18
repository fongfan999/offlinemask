#!/bin/sh
# Render the brand sheets to PNG with librsvg (brew install librsvg).
set -e
cd "$(dirname "$0")"
rsvg-convert -w 2200 sketches.svg -o sketches.png
rsvg-convert -w 2200 sketches-round-1.svg -o sketches-round-1.png
rsvg-convert -w 2200 sketches-dark.svg -o sketches-dark.png
rsvg-convert -w 2200 preview-sheet.svg -o preview-sheet.png
rm -f sketches.svg sketches-round-1.svg sketches-dark.svg preview-sheet.svg
echo "rendered sketches.png, sketches-dark.png, preview-sheet.png"
