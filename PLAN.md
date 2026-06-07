# Cluely-Hidden — Build Plan v0.3.0 (Cheating-Daddy Inspired)

> Each phase = 1+ subagent dispatches with 2-stage review (spec + quality).
> Sequential phases, but tasks within a phase can be parallel.
> All new subagent dispatches go to fresh subagents — clean context.

---

## ✅ Phase 0: Scaffold + Hello-World
- Status: DONE (commit 2728b44)

## ✅ Phase 1: P0 Stealth (content_protected, Accessory)
- Status: DONE (commit 9f56263)
- App is invisible in screen-share, hidden from Dock, hidden from Cmd+Tab

---

## 🚧 Phase 2: 11-Hotkey System + Emergency Erase

**Goal:** Replace the single `⌘+Shift+Space` with 11 rebindable actions. Add the panic button.

**Reference:** `~/Code/cheating-daddy/src/utils/window.js: getDefaultKeybinds()`

**New files:**
- `src-tauri/src/hotkeys/mod.rs` — module root
- `src-tauri/src/hotkeys/actions.rs` — 11 action_id enum + handlers
- `src-tauri/src/hotkeys/registry.rs` — register/unregister/rebind
- `src-tauri/src/state.rs` — `HotkeyState` with bindings map

**Modified files:**
- `src-tauri/src/lib.rs` — wire up new hotkey system
- `src-tauri/src/ipc/commands.rs` — add `rebind_hotkey`, `get_hotkey_bindings`, `emergency_erase` commands
- `src/lib/tauri.ts` — typed wrappers
- `src/lib/store.ts` — zustand slice
- `src/routes/Settings.tsx` — add Hotkeys section (basic for now, full recorder in Phase 5)

**Subagent tasks (sequential — all touch the registry):**

### Task 2.1: Define HotkeyAction enum + defaults
- 11 variants: `ToggleVisibility`, `NextStep`, `EmergencyErase`, `ToggleClickThrough`, `MoveUp`, `MoveDown`, `MoveLeft`, `MoveRight`, `PreviousResponse`, `NextResponse`, `ScrollUp`, `ScrollDown`
- Each has: action_id (string), default key (per platform), handler fn
- Port the keybinds from cheating-daddy verbatim (Cmd+\, Cmd+Enter, etc)

### Task 2.2: Build HotkeyRegistry
- `register_all(app, bindings)` — registers all 11 with the global-shortcut plugin
- `unregister_all(app)` — for rebind flow
- `rebind(app, action_id, new_key)` — unregister old, register new
- Each handler dispatches to the action function

### Task 2.3: Implement EmergencyErase
- Handler: `app.hide()` → close any active AI session → `app.exit(0)`
- 300ms delay between hide and quit (so user sees the window disappear)
- **Wired to ⌘+Shift+E by default**

### Task 2.4: Wire all 11 into lib.rs
- Replace the single `Shortcut::new(...)` registration with `registry.register_all(...)`
- Default state loaded from `HotkeyState::default_bindings()`

### Task 2.5: TypeScript + IPC
- Add `getHotkeyBindings()`, `rebindHotkey(action, key)`, `onShortcutTriggered(cb)` to `src/lib/tauri.ts`
- Add `hotkeyBindings` slice to zustand
- Add basic hotkey display in Settings (just shows current bindings, no editor yet)

**Acceptance criteria:**
- [ ] All 11 hotkeys work as specified
- [ ] ⌘+Shift+E (Emergency Erase) hides the window + quits the app
- [ ] Frontend can read bindings via `getHotkeyBindings()`
- [ ] Hotkey events are emitted to the frontend for UI updates

---

## 🚧 Phase 3: View Architecture + 6 Prompt Profiles

**Goal:** Single window, multi-view router. 6 builtin profiles seeded to SQLite.

**New files:**
- `src/lib/router.ts` — simple view state machine (zustand-backed)
- `src/routes/views/MainView.tsx` — landing/profile select
- `src/routes/views/AssistantView.tsx` — live AI assistant
- `src/routes/views/OnboardingView.tsx` — 4-step first run
- `src/routes/views/CustomizeView.tsx` — appearance
- `src/routes/views/AICustomizeView.tsx` — AI + profile editor
- `src/routes/views/HistoryView.tsx` — past sessions
- `src/routes/views/HelpView.tsx` — docs
- `src/lib/profiles.ts` — the 6 builtin profile definitions (port from cheating-daddy)

**New Rust:**
- `src-tauri/src/db/mod.rs` — rusqlite + migrations
- `src-tauri/src/db/profiles.rs` — profile CRUD
- `src-tauri/src/db/conversations.rs` — conversation CRUD
- `src-tauri/src/db/messages.rs` — message CRUD
- `src-tauri/src/ipc/commands.rs` — add `list_profiles`, `create_profile`, `update_profile`, `delete_profile`, `list_conversations`, `create_conversation`, `list_messages`, `save_message`

**Modified files:**
- `src/App.tsx` — render the active view based on router state
- `src-tauri/Cargo.toml` — add `rusqlite = { version = "0.31", features = ["bundled"] }`, `uuid`, `chrono`

**Subagent tasks:**

### Task 3.1: SQLite setup + migrations
- File: `src-tauri/src/db/mod.rs`
- Opens/creates `~/Library/Application Support/com.cluelyhidden.app/cluely.db`
- Runs migrations for conversations, messages, profiles, captures, settings tables
- On first run, seeds the 6 builtin profiles

### Task 3.2: Port the 6 profiles from cheating-daddy
- File: `src/lib/profiles.ts`
- Direct port of `src/utils/prompts.js` from cheating-daddy
- Each profile has: id, name, systemPrompt (the full composed string)
- Available in both Rust (for the actual prompt) and TS (for the UI)

### Task 3.3: Profile + conversation DB CRUD
- Files: `src-tauri/src/db/{profiles,conversations,messages}.rs`
- Standard CRUD: list, get, create, update, delete
- Return JSON-serializable structs

### Task 3.4: View router
- File: `src/lib/router.ts`
- Zustand slice with `view: 'main' | 'assistant' | 'onboarding' | 'customize' | 'ai-customize' | 'history' | 'help'`
- `setView(view)`, `navigate(view, params?)` functions

### Task 3.5: Build the 7 views (React)
- Each view is a simple component, dark-themed, ~200-400 lines each
- Navigation: sidebar with icons, click to switch view
- Onboarding: 4 steps with progress bar
- Main: profile dropdown + "Start" button
- Assistant: large response area + status indicator (port the "Listening..." pattern)
- History: list of past sessions, search bar, click to load
- Help: keyboard shortcut reference + FAQ
- Customize: theme picker, font size, transparency
- AI Customize: profile editor, model picker, Google Search toggle

### Task 3.6: Wire App.tsx to render the active view
- Single window, single `<App>` component, renders the active view
- Sidebar nav on left
- When overlay is shown, render the active view (default: Assistant)

**Acceptance criteria:**
- [ ] Single window, 7 views accessible via sidebar
- [ ] Onboarding shows on first launch
- [ ] 6 profiles are seeded and selectable
- [ ] Profile selection persists across launches
- [ ] Can create/edit/delete custom profiles
- [ ] History view shows past conversations (empty for now)
- [ ] UI is dark-mode by default, slick

---

## 🚧 Phase 4: Gemini Live Integration (Real-Time)

**Goal:** Wire up `@google/genai` for real-time audio + streaming text responses. Sub-300ms response time.

**New Rust:**
- `src-tauri/src/ai/mod.rs` — module root
- `src-tauri/src/ai/gemini_live.rs` — Gemini Live WebSocket client
- `src-tauri/src/ai/responder.rs` — fast response LLM (Groq/Gemma/Ollama)
- `src-tauri/src/ai/router.rs` — orchestrates: Live listens, Responder responds
- `src-tauri/Cargo.toml` — add `tungstenite`, `tokio-tungstenite`, `serde_json`

**New frontend:**
- `src/lib/gemini.ts` — typed wrappers
- `src/components/StatusBar.tsx` — "Listening..." / "Reconnecting..." / "Thinking..." status

**Subagent tasks:**

### Task 4.1: Gemini Live WebSocket client
- File: `src-tauri/src/ai/gemini_live.rs`
- Connect to `wss://generativelanguage.googleapis.com/ws/...`
- Send `setup` message with model + system instruction + tools
- Send audio chunks (100ms, 24kHz PCM)
- Receive `serverContent` events with `inputTranscription` + `generationComplete`
- Speaker diarization enabled
- Auto-reconnect (max 3 attempts, 2s delay) — port the reconnect logic

### Task 4.2: Fast responder (Gemini Flash HTTP)
- File: `src-tauri/src/ai/responder.rs`
- `respond(transcript) -> Stream<String>` using Gemini Flash HTTP streaming
- Or Groq if user provides a key
- Or Ollama if user wants local
- Returns SSE chunks

### Task 4.3: Router orchestration
- File: `src-tauri/src/ai/router.rs`
- State machine: `Idle → Listening → Thinking → Responding → Idle`
- On `generationComplete` from Live → call Responder → stream to frontend
- Emit Tauri events: `ai:status`, `ai:transcript`, `ai:response:chunk`, `ai:response:complete`

### Task 4.4: Frontend status + streaming
- File: `src/components/StatusBar.tsx`
- Shows current state with color coding: gray (idle), green (listening), yellow (thinking), blue (responding)
- Animated dot indicator
- File: `src/routes/views/AssistantView.tsx` — refactor to listen for `ai:*` events and render

### Task 4.5: API key management
- File: `src-tauri/src/storage.rs`
- Secure storage for Gemini API key (and Groq if used)
- File: `src/routes/views/MainView.tsx` — add API key input on first launch
- "Test connection" button validates the key with a tiny Gemini call

**Acceptance criteria:**
- [ ] User can paste Gemini API key, save it, validate it
- [ ] User can start a session, speak, see real-time transcription
- [ ] AI response streams in within 500ms of stopping speech
- [ ] Status bar shows current state correctly
- [ ] Auto-reconnect works if connection drops
- [ ] Conversation is saved to SQLite

---

## 🚧 Phase 5: Screenshot-Driven UX

**Goal:** `⌘+Enter` takes a screenshot, attaches to the next message, AI analyzes + responds.

**New Rust:**
- `src-tauri/src/capture/mod.rs` — module root
- `src-tauri/src/capture/screen.rs` — xcap-based capture
- `src-tauri/src/ipc/commands.rs` — add `capture_screen` command

**New frontend:**
- `src/components/ScreenshotPreview.tsx` — shows last screenshot in assistant view
- `src/routes/views/AssistantView.tsx` — handle `next_step` action

**Subagent tasks:**

### Task 5.1: Screen capture (Rust)
- File: `src-tauri/src/capture/screen.rs`
- Uses `xcap::Monitor::all().first().capture_image()`
- Returns `RgbaImage`, encode to PNG
- Save to `~/Library/Application Support/com.cluelyhidden.app/captures/{uuid}.png`
- Insert into `captures` table
- Emit `capture:complete` event with `{id, path, width, height}`

### Task 5.2: Add screenshot to Gemini Live
- File: `src-tauri/src/ai/gemini_live.rs`
- Extend to support image input (multimodal)
- When `next_step` fires, take screenshot → send to Live as image inline

### Task 5.3: Wire next_step hotkey
- File: `src-tauri/src/hotkeys/actions.rs`
- `next_step` handler: take screenshot, send to AI, trigger response
- File: `src/components/ScreenshotPreview.tsx`
- Shows the screenshot in the assistant view as a small thumbnail

**Acceptance criteria:**
- [ ] `⌘+Enter` takes a screenshot and triggers AI analysis
- [ ] Screenshot is attached to the next AI response
- [ ] AI responds with analysis of what's on screen
- [ ] Screenshot thumbnail visible in assistant view
- [ ] Captures are stored locally

---

## 🚧 Phase 6: Emergency Erase

**Goal:** `⌘+Shift+E` is the panic button. Test it works.

**Subagent tasks:**

### Task 6.1: Wire emergency_erase handler
- File: `src-tauri/src/hotkeys/actions.rs`
- Handler: hide window → close Gemini Live session → close any capture process → clear in-memory conversation state → emit `clear-sensitive-data` event → `app.exit(0)` after 300ms
- Add a `do_emergency_erase` command callable from JS too (for menu item)

### Task 6.2: Frontend cleanup
- File: `src/lib/store.ts`
- Listen for `clear-sensitive-data` event, clear all in-memory state
- File: `src/lib/router.ts`
- Reset to MainView

### Task 6.3: Test panic flow
- Start a session
- Press ⌘+Shift+E
- Verify: window hides, app quits, no data in memory
- Relaunch: state is fresh (no leftover conversation)

**Acceptance criteria:**
- [ ] ⌘+Shift+E hides window + quits in < 500ms
- [ ] All AI sessions are closed
- [ ] All in-memory state is cleared
- [ ] SQLite history is preserved (user can review later)
- [ ] Reopening app shows fresh state

---

## 🚧 Phase 7: System Audio Capture (Meetings)

**Goal:** Capture macOS system audio, feed to Gemini Live for real-time meeting assistance.

**New Rust:**
- `src-tauri/src/capture/system_audio.rs` — screencapturekit-based
- `src-tauri/Cargo.toml` — add `screencapturekit = "0.3"` (or `objc2` + raw ScreenCaptureKit)

**Subagent tasks:**

### Task 7.1: System audio capture
- File: `src-tauri/src/capture/system_audio.rs`
- On macOS, use `screencapturekit` to capture system audio
- 100ms chunks, 24kHz PCM, mono
- Send to Gemini Live as audio input
- Spawn the capture as a background task
- Stop on demand

### Task 7.2: Wire to ⌘+Shift+M (already in hotkey list, but renamed)
- Actually we use ⌘+M for click-through. Let me reconsider.
- Use `⌘+Shift+A` for "audio toggle" (mic), and add `⌘+Shift+M` for system audio
- File: `src-tauri/src/hotkeys/actions.rs` — add system audio toggle action

### Task 7.3: UI indicator
- File: `src/components/StatusBar.tsx`
- Show "Listening to meeting..." with a different color/animation when system audio is on

**Acceptance criteria:**
- [ ] Can start system audio capture from a hotkey
- [ ] System audio flows to Gemini Live
- [ ] Stop cleanly on demand
- [ ] No audio feedback / no echo

---

## 🚧 Phase 8: Fallback Providers (Ollama + Groq)

**Goal:** User can switch from Gemini Live to local Ollama or cloud Groq for the responder.

**New Rust:**
- `src-tauri/src/ai/providers/mod.rs` — provider trait
- `src-tauri/src/ai/providers/gemini.rs` — Gemini Flash HTTP (already there)
- `src-tauri/src/ai/providers/groq.rs` — Groq HTTP
- `src-tauri/src/ai/providers/ollama.rs` — Ollama HTTP
- `src-tauri/src/ai/providers/factory.rs` — picks provider based on settings

**Subagent tasks:**

### Task 8.1: Provider trait + 3 implementations
- Each provider: `chat_stream(messages, model) -> Stream<String>`
- All use HTTP + SSE

### Task 8.2: Factory + settings integration
- File: `src-tauri/src/ai/providers/factory.rs`
- Read `provider` + `api_key` + `ollama_host` from settings
- Return the right provider

### Task 8.3: UI in AICustomizeView
- Provider dropdown (Gemini / Groq / Ollama)
- API key field for selected provider
- "Test connection" button

**Acceptance criteria:**
- [ ] User can pick provider in settings
- [ ] Each provider works end-to-end
- [ ] Switching providers is instant
- [ ] Local Ollama works without internet

---

## 🚧 Phase 9: Conversation History + Persistence

**Goal:** Conversations persist, are searchable, replayable, deletable.

**New frontend:**
- `src/routes/views/HistoryView.tsx` — list + search + click to load
- `src/lib/conversations.ts` — typed wrappers for the conversation CRUD

**Subagent tasks:**

### Task 9.1: History view
- File: `src/routes/views/HistoryView.tsx`
- List all conversations (title = first user message, or auto-generated)
- Search bar (filters by title + content)
- Click to load (navigate to AssistantView with that conversation)
- Delete with confirmation
- Show timestamp, message count, profile used

### Task 9.2: Save conversation as you go
- After each turn, save user message + assistant response to DB
- File: `src-tauri/src/ai/router.rs` — emit `save:message` event with full message
- File: `src/lib/store.ts` — listen and persist via `save_message` command

### Task 9.3: Load conversation on demand
- When `next_step` is pressed in MainView → start new conversation
- When clicking a past conversation → load it
- Assistant view shows the conversation history as the user interacts

**Acceptance criteria:**
- [ ] All conversations are auto-saved
- [ ] History view lists them with search
- [ ] Click to load works
- [ ] Delete works
- [ ] Cross-launch persistence verified

---

## 🚧 Phase 10: Final Ship (Signed .dmg)

**Goal:** Polished, signed, notarized, ready-to-distribute `.dmg`.

**Subagent tasks:**

### Task 10.1: App icon
- Generate proper 16/32/64/128/256/512/1024 PNGs + .icns
- Replace the placeholder "C" icon
- Sleek, recognizable, works at all sizes

### Task 10.2: Code signing
- Configure `tauri.conf.json` with `bundle.macOS.signingIdentity`
- User sets `APPLE_ID`, `APPLE_PASSWORD` (app-specific), `APPLE_TEAM_ID` env vars
- `tauri build` produces signed .app

### Task 10.3: Notarization
- Configure notarization
- Verify with `spctl --assess --verbose=4`
- Result: "accepted" + "notarized"

### Task 10.4: Final QA
- Clean install on a fresh Mac
- All 11 hotkeys work
- All 7 views accessible
- All 6 profiles work
- All 3 AI providers work
- Emergency erase works
- Stealth works (invisible in screen-share)
- Code-signed .dmg installs without warnings

**Acceptance criteria:**
- [ ] `.dmg` opens, drags to /Applications, launches without warnings
- [ ] All features work end-to-end
- [ ] Code-signed + notarized
- [ ] Total DMG < 30MB
- [ ] README is up to date

---

## Estimated Subagent Count

| Phase | Tasks | Estimated subagent-min |
|---|---|---|
| 2 | 5 | 50 |
| 3 | 6 | 80 (some parallel) |
| 4 | 5 | 70 (Live is complex) |
| 5 | 3 | 35 |
| 6 | 3 | 25 |
| 7 | 3 | 40 |
| 8 | 3 | 35 |
| 9 | 3 | 30 |
| 10 | 4 | 40 |
| **Total** | **35** | **~405 subagent-min** |
| **Real time (with parallel + actual build) | | **~4-6 hours wall clock** |
