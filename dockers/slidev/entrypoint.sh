#!/bin/sh
set -e

SLIDES_DIR="/data/output/preview"
SLIDES_FILE="${SLIDES_DIR}/slides.md"

# Ensure the preview directory exists
mkdir -p "$SLIDES_DIR"

# Create a placeholder slides file if none exists
if [ ! -f "$SLIDES_FILE" ]; then
  cat > "$SLIDES_FILE" << 'PLACEHOLDER'
---
title: 演示预览
---

# 演示预览

等待生成 Markdown...
PLACEHOLDER
  echo "[slidev] Created placeholder ${SLIDES_FILE}"
fi

# Symlink node_modules into the preview directory so Slidev resolves the theme
if [ -d /app/node_modules ] && [ ! -e "${SLIDES_DIR}/node_modules" ]; then
  ln -sf /app/node_modules "${SLIDES_DIR}/node_modules"
  echo "[slidev] Symlinked node_modules into ${SLIDES_DIR}"
fi

echo "[slidev] Starting Slidev on :3030 ..."
exec pnpm exec slidev "$SLIDES_FILE" \
  --port 3030 \
  --remote \
  --open false \
  --theme "@slidev/theme-default"
