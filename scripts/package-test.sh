#!/usr/bin/env bash
# Build unsigned macOS .app + .dmg for local testing (v0.6.0+).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ npm run tauri:build"
npm run tauri:build

APP="$ROOT/src-tauri/target/release/bundle/macos/Cluely Hidden.app"
DMG_DIR="$ROOT/src-tauri/target/release/bundle/dmg"

echo ""
echo "✓ Build complete"
echo "  App:  $APP"
echo "  DMG:  $DMG_DIR"
ls -la "$DMG_DIR" 2>/dev/null || true

if [[ -d "$APP" ]]; then
  echo ""
  echo "Open app folder:"
  open "$(dirname "$APP")"
fi
if ls "$DMG_DIR"/*.dmg 1>/dev/null 2>&1; then
  echo "Open DMG folder:"
  open "$DMG_DIR"
fi