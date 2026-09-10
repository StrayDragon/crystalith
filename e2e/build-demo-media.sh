#!/usr/bin/env bash
# Assemble capture-demo.ts chapter webms into the README demo assets:
#   assets/demo.gif   — inline loop (10fps, 1024w, palette-optimized)
#   docs/demo.mp4     — full walkthrough (h264)
#
# Per-chapter speed multipliers keep the pacing tight: the generate chapter
# hides a ~15s synchronous LLM POST behind a 4x speedup.
#
# Usage: e2e/build-demo-media.sh [VIDEO_DIR]   (default e2e/.tmp/demo-videos)
set -euo pipefail

DIR="${1:-$(dirname "$0")/.tmp/demo-videos}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$DIR/assemble"
mkdir -p "$WORK"

speedup() { # speedup FILE MULTIPLIER OUT
  ffmpeg -y -loglevel error -i "$1" -vf "setpts=PTS/$3" -an "$2"
}

trim_head() { # trim_head FILE SECONDS OUT
  ffmpeg -y -loglevel error -ss "$2" -i "$1" -an "$3"
}

# Normalize every chapter to 25fps yuv420p for lossless concat.
norm() { # norm IN OUT
  ffmpeg -y -loglevel error -i "$1" -r 25 -pix_fmt yuv420p -an "$2"
}

: > "$WORK/list.txt"

add() { # add FILE [SPEED]
  local src="$DIR/$1" out="$WORK/$1"
  if [ -n "${2:-}" ]; then
    speedup "$src" "$out" "$2"
  else
    trim_head "$src" 0.4 "$out"
  fi
  norm "$out" "$out.norm.mp4"
  echo "file '$out.norm.mp4'" >> "$WORK/list.txt"
}

[ -f "$DIR/1-overview.webm" ] && add 1-overview.webm
[ -f "$DIR/2-chat.webm" ] && add 2-chat.webm
[ -f "$DIR/3-generate.webm" ] && add 3-generate.webm 4
[ -f "$DIR/4-research.webm" ] && add 4-research.webm
[ -f "$DIR/5-new-notebook.webm" ] && add 5-new-notebook.webm

mkdir -p "$ROOT/docs" "$ROOT/assets"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$WORK/list.txt" \
  -c:v libx264 -crf 23 -preset medium -movflags +faststart "$ROOT/docs/demo.mp4"

ffmpeg -y -loglevel error -i "$ROOT/docs/demo.mp4" -vf \
  "fps=10,scale=1024:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer" \
  "$ROOT/assets/demo.gif"

echo "→ $ROOT/docs/demo.mp4   $(du -h "$ROOT/docs/demo.mp4" | cut -f1)"
echo "→ $ROOT/assets/demo.gif $(du -h "$ROOT/assets/demo.gif" | cut -f1)"
