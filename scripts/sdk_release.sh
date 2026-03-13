#!/usr/bin/env bash
# Full SDK release flow: generate, commit, tag, push.
#
# Usage: scripts/sdk_release.sh <VERSION>
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="${1:?Usage: sdk_release.sh X.Y.Z}"
TAG="v${VERSION}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty. Commit/stash changes before running sdk-release." >&2
  git status --porcelain >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  echo "sdk-release must be run on branch 'main' (current: $BRANCH)" >&2
  exit 1
fi

git fetch origin main --tags
if git ls-remote --exit-code --tags origin "refs/tags/${TAG}" >/dev/null 2>&1; then
  echo "Tag already exists on origin: ${TAG}" >&2
  exit 1
fi

BACKEND_VERSION="$(python scripts/sdk_version.py get-backend)"
if [[ "$BACKEND_VERSION" != "$VERSION" ]]; then
  echo "Version mismatch: requested=$VERSION backend/py=$BACKEND_VERSION" >&2
  echo "Update backend/py/pyproject.toml first, then rerun: just sdk-release $BACKEND_VERSION" >&2
  exit 1
fi

just sdk-submodule-update
if [[ -n "$(git -C vendor/crystalith-sdks status --porcelain)" ]]; then
  echo "SDK monorepo submodule has uncommitted changes. Commit/stash them first." >&2
  git -C vendor/crystalith-sdks status --porcelain >&2
  exit 1
fi
git -C vendor/crystalith-sdks fetch origin main
git -C vendor/crystalith-sdks pull --rebase origin main

just api-sync

just sdk-gen-python VERSION="$VERSION"
just sdk-gen-typescript VERSION="$VERSION"
just sdk-gen-go VERSION="$VERSION"
just sdk-gen-rust VERSION="$VERSION"

if [[ -n "$(git -C vendor/crystalith-sdks status --porcelain)" ]]; then
  git -C vendor/crystalith-sdks add -A
  git -C vendor/crystalith-sdks commit -m "chore: release sdks ${TAG}"
  git -C vendor/crystalith-sdks push origin main
else
  echo "No changes detected in crystalith-sdks; skipping commit."
fi

for prefix in go python typescript rust; do
  T="${prefix}/${TAG}"
  if git -C vendor/crystalith-sdks ls-remote --exit-code --tags origin "refs/tags/${T}" >/dev/null 2>&1; then
    echo "Tag already exists on crystalith-sdks origin: ${T}" >&2
    exit 1
  fi
  git -C vendor/crystalith-sdks tag "${T}"
done
git -C vendor/crystalith-sdks push origin "go/${TAG}" "python/${TAG}" "typescript/${TAG}" "rust/${TAG}"

git add frontend/web/openapi.gen.json frontend/web/src/api/generated vendor/crystalith-sdks
if [[ -n "$(git diff --cached --name-only)" ]]; then
  git commit -m "chore(release): ${TAG}"
  git push origin main
else
  echo "No changes to commit in crystalith; skipping commit."
fi

just sdk-release-preflight

git tag "${TAG}"
git push origin "${TAG}"
echo "Release tag pushed: ${TAG}"
