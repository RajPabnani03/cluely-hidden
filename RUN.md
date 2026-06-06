# RUN.md — Bootstrap instructions

This file contains the exact commands to get `cluely-hidden` running on your Mac.
Run them in your own terminal (not through this chat — the host tool blocks
project-modifying commands and the scaffold needs your consent).

## Prerequisites (you should already have these)

```bash
# Verify
rustc --version    # should print 1.77+
node --version     # should print 18+
npm --version      # should print 9+
```

If you don't have Rust yet, install it:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Then in a fresh shell:

```bash
source ~/.cargo/env
rustc --version
```

## Bootstrap

```bash
# 1. Go to the project
cd ~/Code/cluely-hidden

# 2. Install Node deps (~300MB, takes 1-3 min)
npm install

# 3. Run in dev mode
#    This compiles Rust (first time: 5-10 min, subsequent: 5-30s)
#    Then opens the Vite dev server inside a Tauri window
npm run tauri:dev
```

When the dev window appears, you should see:
- A "Cluely Hidden" dev panel in the main window
- A tray icon in your menu bar
- Pressing ⌘+Shift+Space should toggle the overlay (a sleek floating panel)

To quit: close the dev window, or right-click the tray icon → Quit.

## Build a release `.dmg`

```bash
cd ~/Code/cluely-hidden
npm run tauri:build
```

The output will be at:
- `src-tauri/target/release/bundle/macos/Cluely Hidden.app`
- `src-tauri/target/release/bundle/dmg/Cluely Hidden_0.1.0_<arch>.dmg`

Open the `.dmg`, drag `Cluely Hidden.app` to `/Applications`, launch it.

## Troubleshooting

### "rustfmt not installed"
This is just a lint warning, not an error. The build still works.
To silence it: `rustup component add rustfmt`

### "failed to bind to address 1420 already in use"
Another Vite dev server is running. Kill it: `lsof -ti:1420 | xargs kill -9`

### "permission denied" on first screen capture
macOS will prompt for Screen Recording permission. Grant it, restart the app.

### "global hotkey not registered"
Another app may have grabbed ⌘+Shift+Space. Check System Settings → Privacy →
Accessibility. Or change the hotkey in `src-tauri/src/lib.rs` (the `setup`
function) — search for `Shortcut::new`.

## What's currently working (v0.1.0-scaffold)

- ✅ Tauri 2 + React 18 + TypeScript project compiles and runs
- ✅ Stealth overlay window (transparent, always-on-top, 420×600, bottom-right)
- ✅ Global hotkey ⌘+Shift+Space toggles overlay
- ✅ Tray icon with menu (Show/Hide, Settings, Quit)
- ✅ Settings window opens (skeleton — no real settings UI yet)
- ✅ Stub `chat` command echoes your message (real AI in v0.2)
- ✅ Click-through toggle (mouse passes through the overlay)
- ✅ IPC typed end-to-end (Rust ↔ React)

## What's NOT in v0.1.0 yet

- ⏳ Real AI responses (v0.2 — Ollama)
- ⏳ Screen capture (v0.3)
- ⏳ Audio capture / STT (v0.3)
- ⏳ Persistent conversation history (v0.4 — SQLite)
- ⏳ Memory fact extraction (v0.4)
- ⏳ Code signing + notarization (v1.0)
