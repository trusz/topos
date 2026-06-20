#!/usr/bin/env bash
# Build topos and package dist/ into a release tarball for Homebrew.
# Output: topos-<version>.tgz (contains dist/cli.js + dist/viewer.global.js)
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(node -p "require('./package.json').version")
TARBALL="topos-${VERSION}.tgz"

echo "==> Installing dependencies (npm ci)"
npm ci

echo "==> Building (npm run build)"
npm run build

echo "==> Packaging ${TARBALL}"
tar -czf "${TARBALL}" dist

echo "==> sha256 (for the Homebrew formula):"
shasum -a 256 "${TARBALL}"

echo "==> Done. Asset: ${TARBALL}"
