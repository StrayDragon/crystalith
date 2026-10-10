#!/usr/bin/env bash
# Assemble capture-demo.ts chapter webms into three README clips:
#   docs/demo-chat.mp4      — 工作台 + 带引用问答
#   docs/demo-notebook.mp4  — 来源 + Studio 输出
#   docs/demo-research.mp4  — Deep Research Lab
#
# Per-chapter speed, then xfade (fade math stays in sped time):
#   DEMO_SPEED=1.1           default for chat / research / sources
#   DEMO_GENERATE_SPEED=2.5  squash Studio LLM waiting in demo-notebook
#
# Usage: e2e/build-demo-media.sh [VIDEO_DIR]
set -euo pipefail

DIR="${1:-$(dirname "$0")/.tmp/demo-videos}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$DIR/assemble"
FADE="${DEMO_XFADE:-0.45}"
SPEED="${DEMO_SPEED:-1.1}"
GENERATE_SPEED="${DEMO_GENERATE_SPEED:-2.5}"
mkdir -p "$WORK" "$ROOT/docs"

norm() { # norm IN OUT
  ffmpeg -y -loglevel error -i "$1" -r 30 -pix_fmt yuv420p -an "$2"
}

xfade_filter() {
  python3 - "$FADE" "$@" <<'PY'
import subprocess, sys
fade = float(sys.argv[1])
files = sys.argv[2:]
durs = []
for f in files:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", f],
        text=True,
    ).strip()
    durs.append(float(out))
parts = []
last = "[0:v]"
acc = 0.0
n = len(files)
for i in range(1, n):
    acc += durs[i - 1]
    offset = max(0.0, acc - fade * i)
    label = "vout" if i == n - 1 else f"v{i}"
    parts.append(
        f"{last}[{i}:v]xfade=transition=fade:duration={fade}:offset={offset:.3f}[{label}]"
    )
    last = f"[{label}]"
print(";".join(parts))
PY
}

prep() { # prep WEBNAME SPEED → prints mp4 path
  local src="$DIR/$1" sped="$WORK/${1%.webm}.s${2}.mp4" raw="$WORK/${1%.webm}.raw.mp4"
  if [ ! -f "$src" ]; then
    echo "missing $1" >&2
    return 1
  fi
  norm "$src" "$raw"
  ffmpeg -y -loglevel error -i "$raw" -vf "setpts=PTS/$2" -an "$sped"
  echo "$sped"
}

join_clips() { # join_clips OUT clip.mp4...
  local out="$1"
  shift
  if [ "$#" -eq 1 ]; then
    ffmpeg -y -loglevel error -i "$1" \
      -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -movflags +faststart "$out"
    return
  fi
  local filter inputs=()
  filter="$(xfade_filter "$@")"
  local c
  for c in "$@"; do
    inputs+=(-i "$c")
  done
  ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "$filter" -map "[vout]" \
    -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -movflags +faststart "$out"
}

emit() {
  local out="$1"
  local dur
  dur="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$out")"
  echo "→ $out  $(du -h "$out" | cut -f1)  ${dur}s"
}

if c1="$(prep 1-overview.webm "$SPEED")" && c2="$(prep 2-chat.webm "$SPEED")"; then
  join_clips "$ROOT/docs/demo-chat.mp4" "$c1" "$c2"
  emit "$ROOT/docs/demo-chat.mp4"
fi
if s1="$(prep 3-sources.webm "$SPEED")" && s2="$(prep 4-generate.webm "$GENERATE_SPEED")"; then
  join_clips "$ROOT/docs/demo-notebook.mp4" "$s1" "$s2"
  emit "$ROOT/docs/demo-notebook.mp4"
fi
if r1="$(prep 5-research.webm "$SPEED")"; then
  join_clips "$ROOT/docs/demo-research.mp4" "$r1"
  emit "$ROOT/docs/demo-research.mp4"
fi
