#!/usr/bin/env bash
# Tag the current commit and publish a GitHub release with the dist tarball.
# Requires `gh` (authenticated).
#
# Usage:
#   ./publish.sh                 publish current package.json version (run ./build.sh first)
#   ./publish.sh --bump patch    bump version (patch|minor|major), commit, build, publish
set -euo pipefail
cd "$(dirname "$0")"

BUMP=""
if [ "${1:-}" = "--bump" ]; then
  BUMP="${2:-}"
  case "${BUMP}" in
    patch|minor|major) ;;
    *) echo "error: --bump requires a level: patch | minor | major" >&2; exit 1 ;;
  esac
fi

if [ -n "${BUMP}" ]; then
  echo "==> Bumping version (${BUMP})"
  npm version "${BUMP}" --no-git-tag-version
  VERSION=$(node -p "require('./package.json').version")
  git add package.json package-lock.json
  git commit -m "release v${VERSION}"
  echo "==> Building tarball for v${VERSION}"
  ./build.sh
fi

VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"
TARBALL="topos-${VERSION}.tgz"

if [ ! -f "${TARBALL}" ]; then
  echo "error: ${TARBALL} not found — run ./build.sh first (or use --bump)" >&2
  exit 1
fi

echo "==> Tagging ${TAG}"
git tag -a "${TAG}" -m "${TAG}"
git push origin HEAD --follow-tags

echo "==> Creating GitHub release ${TAG}"
gh release create "${TAG}" "${TARBALL}" \
  --title "${TAG}" \
  --notes "Homebrew-installable release ${TAG}."

echo "==> Done."
echo "Asset URL: https://github.com/trusz/topos/releases/download/${TAG}/${TARBALL}"
echo "Update Formula/topos.rb in trusz/homebrew-tap with the new url + sha256 from build.sh."
