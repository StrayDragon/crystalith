#!/usr/bin/env bash
# Regenerate web favicon + PWA icons from assets/logo.webp (brand SSOT).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/assets/logo.webp"
OUT="$ROOT/apps/web/public"
WORK="$ROOT/.tmp/brand-icons"

if [[ ! -f "$SRC" ]]; then
  echo "❌ Missing brand source: $SRC" >&2
  exit 1
fi

if ! command -v magick >/dev/null 2>&1; then
  echo "❌ ImageMagick (magick) is required — install imagemagick" >&2
  exit 1
fi

mkdir -p "$OUT" "$WORK"

# Normalize: ensure alpha (flood-fill near-white corners when source is opaque).
channels="$(magick identify -format '%[channels]' "$SRC")"
NORMALIZED="$WORK/logo-normalized.webp"
if [[ "$channels" != *"a"* && "$channels" != *"A"* ]]; then
  width="$(magick identify -format '%w' "$SRC")"
  height="$(magick identify -format '%h' "$SRC")"
  magick "$SRC" -alpha set -channel A -fuzz 10% -fill none \
    -draw "alpha 0,0 floodfill" \
    -draw "alpha $((width - 1)),0 floodfill" \
    -draw "alpha 0,$((height - 1)) floodfill" \
    -draw "alpha $((width - 1)),$((height - 1)) floodfill" \
    -define webp:lossless=true \
    "$NORMALIZED"
else
  magick "$SRC" -define webp:lossless=true "$NORMALIZED"
fi

magick "$NORMALIZED" -background none -define icon:auto-resize=64,48,32,16 "$OUT/favicon.ico"
magick "$NORMALIZED" -background none -resize 192x192 "$OUT/logo192.png"
magick "$NORMALIZED" -background none -resize 512x512 "$OUT/logo512.png"
magick "$NORMALIZED" -background none -resize 180x180 "$OUT/apple-touch-icon.png"
magick "$NORMALIZED" -define webp:lossless=true "$OUT/logo.webp"

echo "✅ Brand icons written to apps/web/public/ (source: assets/logo.webp)"
