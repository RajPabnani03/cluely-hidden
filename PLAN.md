# Cluely-Hidden — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to execute this plan task-by-task.
> Each task = 2-5 min of focused work. TDD where it makes sense. Commit after every task.

**Goal:** Ship a working, signed, notarized `.dmg` of a stealth AI assistant overlay for macOS.

**Architecture:** Tauri 2 (Rust core) + React 18 + TypeScript. Local-first. Modular. Each phase ends with a working `.dmg`.

**Tech Stack:** Tauri 2.1+, Rust 1.96, React 18, TypeScript 5, Vite 5, Tailwind 3, shadcn/ui, Zustand, SQLite (rusqlite), Ollama (HTTP).

---

## Phase 0: Project Scaffolding & Tooling

### Task 0.1: Initialize Tauri 2 project

**Files:** `~/Code/cluely-hidden/*` (entire project tree)

**Step 1:** Use `create-tauri-app` non-interactively to scaffold the project in place.

```bash
cd ~/Code/cluely-hidden
npm create tauri-app@latest . -- --template react-ts --manager npm --identifier com.cluelyhidden.app --yes
```

**Step 2:** Verify scaffold:
```bash
ls -la
cat package.json
cat src-tauri/tauri.conf.json | head -30
```

**Step 3:** Add PATH for cargo to your shell profile permanently (if not already):
```bash
grep -q 'cargo/env' ~/.zshrc || echo '\n# Rust\nsource "$HOME/.cargo/env"' >> ~/.zshrc
```

**Step 4:** Commit:
```bash
cd ~/Code/cluely-hidden
git add -A
git commit -m "chore: scaffold tauri 2 + react-ts project"
```

**Verification:** `package.json` and `src-tauri/Cargo.toml` exist, `npm run tauri --version` succeeds.

---

### Task 0.2: Configure project metadata & capabilities

**Files:** `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`

**Step 1:** Update `src-tauri/tauri.conf.json`:
- `productName`: "Cluely Hidden"
- `version`: "0.1.0"
- `identifier`: "com.cluelyhidden.app"
- `bundle.macOS.minimumSystemVersion`: "12.0"
- Add `bundle.macOS.entitlements` and `bundle.macOS.exceptionDomain` (empty for now)

**Step 2:** Update `src-tauri/capabilities/default.json` to grant permissions we'll need:
- `core:default`
- `core:window:allow-show`
- `core:window:allow-hide`
- `core:window:allow-set-focus`
- `core:window:allow-set-always-on-top`
- `core:window:allow-set-ignore-cursor-events`
- `core:webview:allow-internal-toggle-devtools`
- `core:event:default`

**Step 3:** Commit:
```bash
git add -A && git commit -m "chore: configure tauri metadata + capabilities"
```

---

### Task 0.3: Add Tailwind CSS + shadcn/ui setup

**Files:** `package.json`, `tailwind.config.js`, `postcss.config.js`, `src/index.css`

**Step 1:** Install Tailwind + shadcn deps:
```bash
cd ~/Code/cluely-hidden
npm install -D tailwindcss@3 postcss autoprefixer
npm install class-variance-authority clsx tailwind-merge lucide-react
npx tailwindcss init -p
```

**Step 2:** Configure `tailwind.config.js` with content paths and dark mode.

**Step 3:** Replace `src/index.css` with Tailwind directives + dark mode defaults.

**Step 4:** Create `src/lib/utils.ts` with the standard `cn()` helper.

**Step 5:** Verify build: `npm run build`

**Step 6:** Commit:
```bash
git add -A && git commit -m "chore: add tailwind + shadcn base setup"
```

---

### Task 0.4: Add Zustand + base IPC types

**Files:** `package.json`, `src/lib/tauri.ts`, `src/lib/store.ts`

**Step 1:** Install Zustand:
```bash
npm install zustand
```

**Step 2:** Create `src/lib/tauri.ts` — typed IPC wrappers (skeleton, commands added per phase):
```typescript
import { invoke } from '@tauri-apps/api/core';
// typed wrappers added as we implement commands
```

**Step 3:** Create `src/lib/store.ts` — base Zustand store for overlay state (visible, click-through, current conversation).

**Step 4:** Commit:
```bash
git add -A && git commit -m "chore: add zustand + ipc skeleton"
```

---

### Task 0.5: Verify cold-start build (hello-world .dmg)

**Files:** (none modified)

**Step 1:** Run dev mode to verify it launches:
```bash
cd ~/Code/cluely-hidden
npm run tauri dev
# Wait for window to appear, then quit (Cmd+Q)
```

**Step 2:** Run release build to produce a real `.app` and `.dmg`:
```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/macos/Cluely Hidden.app
#         src-tauri/target/release/bundle/dmg/Cluely Hidden_0.1.0_<arch>.dmg
```

**Step 3:** Test the `.dmg`:
- Open the `.dmg`
- Drag app to `/Applications`
- Launch from Finder
- Verify window appears with default Vite + React content
- Quit

**Step 4:** Tag this commit as the first `.dmg` milestone:
```bash
git tag v0.1.0-phase0
```

**Verification:** Working `.dmg` exists, installs, launches, shows window. This is our baseline.

---

## Phase 1: Stealth Overlay Window

### Task 1.1: Add Rust dependencies for window management

**Files:** `src-tauri/Cargo.toml`

**Step 1:** Add deps:
```toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api"] }
tauri-plugin-global-shortcut = "2"
tauri-plugin-tray = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
anyhow = "1"
```

**Step 2:** `cd src-tauri && cargo check` — verify it builds.

**Step 3:** Commit.

---

### Task 1.2: Create Rust window module

**Files:** `src-tauri/src/window/mod.rs`, `src-tauri/src/window/overlay.rs`, `src-tauri/src/window/helpers.rs`, `src-tauri/src/lib.rs`

**Step 1:** Create `src-tauri/src/window/mod.rs`:
```rust
pub mod overlay;
pub mod helpers;
```

**Step 2:** Create `src-tauri/src/window/overlay.rs` — function `create_overlay_window(app: &tauri::AppHandle) -> Result<()>`. Sets:
- `decorations: false`
- `transparent: true`
- `always_on_top: true`
- `skip_taskbar: true`
- `resizable: false`
- Position: bottom-right of primary monitor, 420×600
- `visible: false` (starts hidden)
- `focus: false`

**Step 3:** Create `src-tauri/src/window/helpers.rs` with `show_overlay`, `hide_overlay`, `toggle_overlay`, `set_click_through`.

**Step 4:** Wire into `lib.rs`:
```rust
mod window;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            window::overlay::create_overlay_window(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window::helpers::toggle_overlay,
            window::helpers::show_overlay,
            window::helpers::hide_overlay,
            window::helpers::set_click_through,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 5:** Add `#[tauri::command]` annotations to the helper functions with typed args/returns.

**Step 6:** Verify build: `cd src-tauri && cargo check`

**Step 7:** Commit.

---

### Task 1.3: Configure overlay window in tauri.conf.json

**Files:** `src-tauri/tauri.conf.json`

**Step 1:** Add a second window config to `tauri.conf.json`:
```json
"windows": [
  {
    "label": "main",
    "title": "Cluely Hidden",
    "width": 420,
    "height": 600,
    "decorations": false,
    "transparent": true,
    "alwaysOnTop": true,
    "skipTaskbar": true,
    "resizable": false,
    "visible": false
  }
]
```

**Step 2:** Verify: `npm run tauri dev` — main window should be hidden initially (we'll trigger via IPC next).

**Step 3:** Commit.

---

### Task 1.4: Build overlay UI shell (React)

**Files:** `src/App.tsx`, `src/components/OverlayShell.tsx`, `src/routes/Overlay.tsx`, `src/styles/overlay.css`

**Step 1:** Create `OverlayShell.tsx` — rounded panel, backdrop-blur, drag handle, close button, click-through toggle button. Use Tailwind.

**Step 2:** Update `App.tsx` to render the overlay shell.

**Step 3:** Add dev-only "show overlay" button at the bottom of the screen (only visible when `import.meta.env.DEV`).

**Step 4:** Verify in `npm run tauri dev` — overlay looks like a sleek floating panel.

**Step 5:** Commit.

---

### Task 1.5: Test overlay show/hide via dev console

**Files:** (none — manual test)

**Step 1:** Run `npm run tauri dev`.

**Step 2:** Open devtools (right-click → Inspect), run in console:
```js
window.__TAURI__.core.invoke('show_overlay')
// verify overlay appears
window.__TAURI__.core.invoke('hide_overlay')
// verify overlay disappears
```

**Step 3:** Commit any tweaks. Phase 1 done when overlay correctly shows/hides via IPC.

---

## Phase 2: Global Hotkey & Tray

### Task 2.1: Add global shortcut plugin

**Files:** `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`

**Step 1:** Register `tauri-plugin-global-shortcut` in `lib.rs`:
```rust
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

.plugin(
    tauri_plugin_global_shortcut::Builder::new()
        .with_shortcuts(["CmdOrCtrl+Shift+Space"])?
        .with_handler(|app, shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let _ = window::helpers::toggle_overlay(app);
            }
        })
        .build(),
)
```

**Step 2:** Verify: `npm run tauri dev`, press ⌘+Shift+Space — overlay toggles.

**Step 3:** Commit.

---

### Task 2.2: Add tray icon with menu

**Files:** `src-tauri/src/window/tray.rs`, `src-tauri/src/window/mod.rs`, `src-tauri/src/lib.rs`

**Step 1:** Create `tray.rs` with menu items: "Show/Hide Overlay", "Settings…", "Quit".

**Step 2:** Register tray in `lib.rs` setup hook using `tauri::tray::TrayIconBuilder`.

**Step 3:** Add a tray icon asset: `src-tauri/icons/tray-icon.png` (16×16, template style).

**Step 4:** Verify: tray icon appears in menu bar, menu items work, quit exits cleanly.

**Step 5:** Commit.

---

### Task 2.3: Add permissions for global-shortcut & tray

**Files:** `src-tauri/capabilities/default.json`

**Step 1:** Add:
```json
{
  "identifier": "global-shortcut:default",
  "allow": [{ "identifier": "global-shortcut:default" }]
}
```

**Step 2:** Verify capabilities load — `npm run tauri dev` shouldn't error on startup.

**Step 3:** Commit. Phase 2 done when ⌘+Shift+Space toggles overlay AND tray menu works.

---

## Phase 3: Settings Window

### Task 3.1: Add settings window

**Files:** `src-tauri/tauri.conf.json`, `src/routes/Settings.tsx`, `src-tauri/src/window/helpers.rs`

**Step 1:** Add second window in `tauri.conf.json`:
```json
{
  "label": "settings",
  "title": "Cluely Hidden — Settings",
  "width": 600,
  "height": 500,
  "url": "settings.html"
}
```

**Step 2:** Create `src/settings.html` and `src/routes/Settings.tsx` — basic settings form (hotkey, theme toggle, about).

**Step 3:** Add `open_settings` command in `helpers.rs`.

**Step 4:** Wire tray "Settings…" menu item to `open_settings`.

**Step 5:** Verify: tray → Settings opens the window, can be closed via X.

**Step 6:** Commit.

---

## Phase 4: Screen & Audio Capture

### Task 4.1: Screen capture via ScreenCaptureKit

**Files:** `src-tauri/src/capture/mod.rs`, `src-tauri/src/capture/screen.rs`, `src-tauri/Cargo.toml`

**Step 1:** Add deps:
```toml
[dependencies]
screencapturekit = "0.3"
image = "0.25"
```

**Step 2:** Implement `capture_screen(app, mode: "window" | "display")` — uses ScreenCaptureKit, saves PNG to `app_data_dir/captures/`, returns path + dimensions.

**Step 3:** Handle macOS TCC permission prompt on first capture.

**Step 4:** Add `capture_screen` command.

**Step 5:** Verify in `npm run tauri dev` + invoke from console: produces a PNG file.

**Step 6:** Commit.

---

### Task 4.2: Audio capture (microphone)

**Files:** `src-tauri/src/capture/audio.rs`, `src-tauri/Cargo.toml`

**Step 1:** Add deps:
```toml
[dependencies]
cpal = "0.15"
hound = "3.5"
```

**Step 2:** Implement `start_audio_capture` and `stop_audio_capture` — record to WAV file using cpal + hound.

**Step 3:** Add commands.

**Step 4:** Verify: record 5 seconds, produces a valid WAV file.

**Step 5:** Commit. Phase 4 done when both screen + audio capture produce real files.

---

## Phase 5: Chat UI

### Task 5.1: Build chat components

**Files:** `src/components/ChatStream.tsx`, `src/components/InputBar.tsx`, `src/components/Message.tsx`

**Step 1:** `Message.tsx` — bubble with role-based styling (user right-aligned, assistant left).

**Step 2:** `ChatStream.tsx` — virtualized list of messages, auto-scroll to bottom, typing indicator.

**Step 3:** `InputBar.tsx` — text input + send button + mic button + capture button.

**Step 4:** Wire into `Overlay.tsx` replacing the placeholder.

**Step 5:** Verify: type a message, see it appear in the stream.

**Step 6:** Commit.

---

### Task 5.2: Stub chat command in Rust

**Files:** `src-tauri/src/ai/mod.rs`, `src-tauri/src/ai/router.rs`, `src-tauri/src/lib.rs`

**Step 1:** Create `ai/mod.rs` and `ai/router.rs` with a stub `chat` command that echoes the input.

**Step 2:** Register command.

**Step 3:** Wire `InputBar` to call `chat` command, render response in stream.

**Step 4:** Verify: send a message, see the echo back.

**Step 5:** Commit.

---

## Phase 6: SQLite Persistence

### Task 6.1: Add SQLite + migrations

**Files:** `src-tauri/src/memory/mod.rs`, `src-tauri/src/memory/store.rs`, `src-tauri/Cargo.toml`

**Step 1:** Add deps:
```toml
[dependencies]
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1", features = ["v4", "serde"] }
```

**Step 2:** Implement `MemoryStore::new(path) -> Result<Self>` — opens DB, runs migrations.

**Step 3:** Schema migrations create the tables from ARCHITECTURE.md §4.

**Step 4:** Add commands: `list_conversations`, `create_conversation`, `save_message`, `list_messages`.

**Step 5:** Verify: invoke commands from devtools, rows appear in DB.

**Step 6:** Commit.

---

### Task 6.2: Wire chat to persistence

**Files:** `src/components/InputBar.tsx`, `src/lib/store.ts`

**Step 1:** On message send: create conversation if none, save user message, call `chat`, save assistant response.

**Step 2:** On overlay open: load last conversation's messages.

**Step 3:** Verify: send 3 messages, quit, relaunch, see history.

**Step 4:** Commit. Phase 6 done.

---

## Phase 7: AI Brain (Ollama)

### Task 7.1: Ollama client

**Files:** `src-tauri/src/ai/ollama.rs`

**Step 1:** Implement `OllamaClient::chat(messages, model) -> Stream<String>` using `reqwest` + Server-Sent Events.

**Step 2:** Add `chat` command that streams chunks back to the frontend via Tauri events.

**Step 3:** Verify: install Ollama, run `ollama pull llama3.2:3b`, send a message in overlay, see streamed response.

**Step 4:** Commit.

---

### Task 7.2: Memory fact extraction

**Files:** `src-tauri/src/memory/facts.rs`, `src-tauri/src/ai/router.rs`

**Step 1:** After each conversation, run a small LLM call to extract facts ("User prefers dark mode").

**Step 2:** Store facts with embeddings (stub: empty embedding for now, real embeddings in v0.3).

**Step 3:** Add `list_memory_facts` command + `MemoryInspector` UI route.

**Step 4:** Verify: have 2 conversations, see facts appear in inspector.

**Step 5:** Commit. Phase 7 done.

---

## Phase 8: Final Packaging & Ship

### Task 8.1: Configure code signing & notarization

**Files:** `src-tauri/tauri.conf.json`, environment

**Step 1:** Add Apple Developer ID to env (`APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`).

**Step 2:** Configure `tauri.conf.json` `bundle.macOS.signingIdentity`.

**Step 3:** Run `npm run tauri build` — verify signed + notarized.

**Step 4:** Verify: `codesign -dvv` on the `.app`, `spctl --assess` on the `.dmg`.

**Step 5:** Commit.

---

### Task 8.2: Polish + smoke test

**Files:** various

**Step 1:** Add an onboarding window that opens on first launch.

**Step 2:** Add an app icon set (replace default Tauri icons).

**Step 3:** Update README with install + usage instructions.

**Step 4:** Final manual smoke test on a clean install.

**Step 5:** Tag `v0.1.0`, push.

---

## Execution Notes

- **Test as you go.** Don't accumulate 10 untested tasks. Verify each one in `npm run tauri dev` or `cargo test` before moving on.
- **Commit after every task.** Even small ones. The history is your rollback.
- **When stuck > 5 min, ask.** Don't burn context on debugging rabbit holes.
- **Parallelize where safe.** Tasks that don't share files can be dispatched together via `delegate_task(tasks=[...])`.
- **Sequential for foundations.** Scaffolding, config, main.rs — these must be done in order.

## Estimated Effort (per phase)

| Phase | Tasks | Subagent-min | Real-time (parallel) |
|---|---|---|---|
| 0 — Scaffolding | 5 | 25 | ~10 min |
| 1 — Overlay | 5 | 30 | ~15 min |
| 2 — Hotkey + Tray | 3 | 20 | ~10 min |
| 3 — Settings | 1 | 15 | ~10 min |
| 4 — Capture | 2 | 40 | ~25 min (compile times) |
| 5 — Chat UI | 2 | 25 | ~15 min |
| 6 — Persistence | 2 | 25 | ~15 min |
| 7 — AI Brain | 2 | 35 | ~20 min (Ollama setup) |
| 8 — Ship | 2 | 30 | ~20 min |
| **Total** | **24** | **~245 subagent-min** | **~2.5 hours wall clock** |
