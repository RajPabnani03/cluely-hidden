# Test install — v0.6.0

## Build (on your Mac)

```bash
cd ~/Code/cluely-hidden
npm ci
npm run tauri:build
```

**Outputs** (unsigned, local test):

| Artifact | Path |
|----------|------|
| **.app** | `src-tauri/target/release/bundle/macos/Cluely Hidden.app` |
| **.dmg** | `src-tauri/target/release/bundle/dmg/Cluely Hidden_0.6.0_*.dmg` |

## Install from DMG

1. Open the `.dmg` from Finder.
2. Drag **Cluely Hidden** to **Applications** (or run from the mounted volume).
3. First launch: **Right-click → Open** if macOS blocks an unsigned app, then confirm.

## First-run checklist

1. **Settings → Model** — Gemini API key (or env the app reads per your setup).
2. **Settings → General** — overlay opacity, VAD, stealth tier.
3. Summon overlay (default **⌘\\** unless you changed hotkeys).
4. **Start listening** → optional **Screen** → **⌘↵** for Assist / dual-brain.
5. **Hide** when you need the card off-screen.

## Permissions (macOS)

Grant when prompted:

- **Microphone** — live session
- **Screen Recording** — capture / dual-brain
- **Accessibility** — global hotkeys (if your build requires it)

## Replace an older install

Quit the old app, delete `Applications/Cluely Hidden.app`, install the new `.app` from this build. Local SQLite lives in the app data dir (not wiped by reinstall unless you use **Erase local data** in Settings).

## Dev vs packaged

| | `npm run tauri:dev` | Packaged `.app` |
|--|---------------------|-----------------|
| Hot reload | Yes | No |
| Same UX build | Yes | Yes (after `tauri:build`) |
| Gatekeeper | N/A | Unsigned → Right-click Open |

## Report issues

Note: macOS version, signed/unsigned, steps, and whether overlay appears on screen share (expected: hidden from share when stealth is configured).