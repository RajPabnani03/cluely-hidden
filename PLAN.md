# Cluely-Hidden — Build Plan v0.2.0 (P0 Stealth + Gemini)

> Each phase = 1 subagent dispatch with 2-stage review.
> Sequential phases (P1 must finish before P2 starts) — but inside a phase, tasks can run in parallel.

---

## ✅ Phase 0: Scaffold + Hello-World
- Status: DONE
- Commit: `2728b44`
- App launches, tray icon works, ⌘+Shift+Space toggles overlay, stub chat echoes

## ✅ Phase 0b: Stealth compilation fix
- Status: DONE
- Commit: `afd1633`
- `image-png` feature enabled, removed unused imports, build succeeds

---

## 🚧 Phase 1: P0 — Maximum Stealth

**Goal:** The window is invisible in Zoom/Meet/Teams/Discord screen-share, hidden from Dock, hidden from Cmd+Tab, and not in macOS screenshots. No one knows it's running.

**Why now:** Everything else is meaningless if the app is visible. Stealth is the foundation.

**Files to modify:**
- `src-tauri/Cargo.toml` — no change (features already right)
- `src-tauri/tauri.conf.json` — remove `visible: false` from main window? No, keep hidden by default. Add `titleBarStyle: "Overlay"`.
- `src-tauri/src/lib.rs` — set `ActivationPolicy::Accessory` in setup hook
- `src-tauri/src/window/overlay.rs` — add `content_protected(true)`, `hidden_title(true)`, `title_bar_style(Overlay)`

**Subagent tasks (sequential — they touch the same file):**

### Task 1.1: Add `content_protected(true)` to overlay window
- File: `src-tauri/src/window/overlay.rs`
- Add `.content_protected(true)` to the WebviewWindowBuilder chain
- Verify: build, launch, take a screenshot (Cmd+Shift+3), confirm no overlay window in the screenshot
- Test in Zoom/Meet/Discord screen-share if possible

### Task 1.2: Set ActivationPolicy to Accessory
- File: `src-tauri/src/lib.rs`
- In `setup`, after creating the overlay, call:
  ```rust
  app.set_activation_policy(tauri::ActivationPolicy::Accessory);
  ```
  Wait — `app` is `&mut App`, and the API is `app.set_activation_policy(...)` directly on `App` (not `AppHandle`).
- Verify: launch, check Cmd+Tab (Cluely Hidden should NOT be in the app switcher), check Dock (no icon)

### Task 1.3: Add `title_bar_style(Overlay)` + `hidden_title(true)` to overlay
- File: `src-tauri/src/window/overlay.rs`
- These are macOS-only — use `#[cfg(target_os = "macos")]`
- Verify: build, launch, the overlay window should have a sleek overlay-style title bar (for drag area) when shown

**Acceptance criteria:**
- [ ] App is not in macOS Dock
- [ ] App is not in Cmd+Tab app switcher
- [ ] Overlay window does NOT appear in macOS screenshot (Cmd+Shift+3)
- [ ] Overlay window does NOT appear in Zoom/Meet/Teams/Discord screen-share
- [ ] Tray icon IS visible in menu bar
- [ ] ⌘+Shift+Space still summons overlay
- [ ] Overlay can be clicked, dragged, dismissed

**Subagent for this phase: `rust-stealth-window-lead`**

---

## 🚧 Phase 2: P0 — Multi-Hotkey System (7 Actions)

**Goal:** Replace the single `⌘+Shift+Space` with 7 action-based hotkeys. Settings will let users rebind them.

**Files to modify:**
- `src-tauri/src/hotkeys/mod.rs` (new) — action_id-based dispatch
- `src-tauri/src/hotkeys/actions.rs` (new) — the 7 action handlers
- `src-tauri/src/hotkeys/registry.rs` (new) — register/unregister/rebind
- `src-tauri/src/lib.rs` — wire up the new hotkey system
- `src-tauri/src/state.rs` (new) — `HotkeyState` with the bindings map
- `src/lib/tauri.ts` — typed wrappers for the 7 actions
- `src/lib/store.ts` — zustand slice for hotkey bindings
- `src/routes/Settings.tsx` — add Hotkeys section

**Subagent tasks:**

### Task 2.1: Define the 7 action_ids + defaults
- File: `src-tauri/src/hotkeys/actions.rs`
- Enum `HotkeyAction` with 7 variants
- Each has a default key combo per platform
- Each maps to a function `(&AppHandle) -> Result<()>`

### Task 2.2: Build the registry
- File: `src-tauri/src/hotkeys/registry.rs`
- `HotkeyRegistry` stores `HashMap<HotkeyAction, Shortcut>`
- `register_all(app)` registers all 7
- `unregister_all(app)` for rebind flow
- `rebind(app, action, new_shortcut)` swaps one
- Each shortcut has a handler that dispatches to the action function

### Task 2.3: Wire it into lib.rs
- File: `src-tauri/src/lib.rs`
- In setup: call `registry.register_all(&app.handle())`
- Expose `rebind_hotkey` and `get_hotkey_bindings` as `#[tauri::command]`

### Task 2.4: TypeScript side
- File: `src/lib/tauri.ts`
- Add wrappers: `getHotkeyBindings()`, `rebindHotkey(action, key)`, `onShortcutTriggered(cb)`
- File: `src/lib/store.ts`
- Add `hotkeyBindings` slice

**Acceptance criteria:**
- [ ] All 7 hotkeys fire and dispatch the right action
- [ ] Frontend can read current bindings via `getHotkeyBindings()`
- [ ] Frontend can rebind via `rebindHotkey('toggle_overlay', 'Cmd+Shift+D')` and it works immediately
- [ ] Settings UI shows current bindings and lets user rebind each

---

## 🚧 Phase 3: P0 — Real Gemini Integration

**Goal:** Replace the stub `chat` command with a real streaming call to Google Gemini. API key in secure storage. 3 models (flash, flash-thinking, pro). 7 prompt templates.

**Files:**
- `src-tauri/src/ai/mod.rs` (new) — module root
- `src-tauri/src/ai/gemini.rs` (new) — Gemini API client (reqwest + SSE)
- `src-tauri/src/ai/router.rs` (new) — model picker, prompt selection
- `src-tauri/src/ai/prompts.rs` (new) — the 7 prompt templates
- `src-tauri/src/storage.rs` (new) — secure_storage.json read/write
- `src-tauri/src/db/mod.rs` (new) — rusqlite connection + migrations
- `src-tauri/src/db/prompts.rs` (new) — prompt CRUD
- `src-tauri/src/db/conversations.rs` (new) — conversation CRUD
- `src-tauri/src/ipc/commands.rs` — replace stub `chat` with real one
- `src-tauri/Cargo.toml` — add reqwest, rusqlite, tokio, futures
- `src/lib/tauri.ts` — typed streaming chat
- `src/components/ChatStream.tsx` — handle streaming chunks
- `src/components/InputBar.tsx` — call chat_stream
- `src/routes/Settings.tsx` — add API key + model picker + prompt selector
- `src/lib/prompts.ts` (new) — the 7 prompt constants

**Subagent tasks (parallel where possible):**

### Task 3.1: Secure storage for API key
- File: `src-tauri/src/storage.rs`
- `set_api_key(key)`, `get_api_key() -> Option<String>`, `has_api_key() -> bool`
- Stored in `~/Library/Application Support/com.cluelyhidden.app/secure_storage.json`
- File mode 0600 (owner read/write only)
- Add `set_api_key`, `has_api_key` commands

### Task 3.2: SQLite + migrations
- File: `src-tauri/src/db/mod.rs`
- Opens/creates `conversations.db`
- Runs migrations: conversations, messages, prompts, captures, settings tables
- All schema from ARCHITECTURE §9

### Task 3.3: Gemini API client
- File: `src-tauri/src/ai/gemini.rs`
- `GeminiClient::stream_chat(messages, model) -> impl Stream<Item=Result<String>>`
- Uses Gemini's OpenAI-compatible endpoint OR native API (you pick based on what's simpler)
- Streams tokens back via Tauri events: `chat:chunk` events

### Task 3.4: The 7 prompt templates
- File: `src-tauri/src/ai/prompts.rs` + `src/lib/prompts.ts`
- Port all 7 from Pluely's `lib/platform-instructions.ts`
- On first launch, seed the DB with these as `is_template=1`

### Task 3.5: Wire the chat command
- File: `src-tauri/src/ipc/commands.rs`
- Replace stub `chat` with real `chat_stream`
- Accepts `{ conversation_id, message, attachments, model?, prompt_id? }`
- Loads conversation history from DB
- Loads the active prompt
- Calls Gemini
- Streams chunks via Tauri events
- Saves user + assistant messages to DB

### Task 3.6: Frontend chat UI
- File: `src/components/ChatStream.tsx`
- Listen for `chat:chunk` events, append to last assistant message
- Show typing indicator while waiting
- Render markdown (use `react-markdown`)
- File: `src/components/InputBar.tsx`
- Call `chat_stream`, handle streaming
- Show stop button while streaming

### Task 3.7: Settings — API key input
- File: `src/routes/Settings.tsx`
- Password input for API key (mask with dots)
- "Test" button: validates the key with a tiny Gemini call
- "Save" button: stores in secure storage
- "Where do I get a key?" link to `aistudio.google.com/apikey`

### Task 3.8: Settings — Model picker + Prompt selector
- File: `src/routes/Settings.tsx`
- Model dropdown: gemini-2.0-flash, gemini-2.0-flash-thinking, gemini-2.5-pro
- Prompt dropdown: the 7 templates, plus "Custom" for user-edited
- Selection stored in `settings` table

**Acceptance criteria:**
- [ ] User can paste Gemini API key, save it, validate it
- [ ] User can pick a model
- [ ] User can pick a prompt template
- [ ] Sending a message in overlay returns a real streamed response from Gemini
- [ ] Conversation is saved to SQLite and restored on next launch
- [ ] All 7 prompt templates are available and selectable
- [ ] Markdown is rendered (code blocks, bold, italic, lists)
- [ ] Streaming animation feels smooth

**Subagent for this phase: `ai-integration-lead` (Rust) + `chat-ui-lead` (React), parallel**

---

## 🚧 Phase 4: P0 — Chat UI Polish

**Goal:** The chat panel feels like Linear or Notion AI. Sleek, fast, beautiful.

**Files:**
- `src/components/Message.tsx` (new) — single message bubble with markdown
- `src/components/ChatStream.tsx` — refactor to use Message
- `src/components/CodeBlock.tsx` (new) — syntax-highlighted code blocks
- `src/components/TypingDots.tsx` (new) — animated typing indicator
- `src/lib/markdown.ts` (new) — markdown config (sanitize, plugins)

**Subagent tasks:**

### Task 4.1: Message component
- File: `src/components/Message.tsx`
- Props: `{ role, content, streaming }`
- User messages: right-aligned, primary color bubble
- Assistant: left-aligned, muted color bubble
- Markdown via `react-markdown` with `remark-gfm`
- Code blocks via `CodeBlock`

### Task 4.2: Code block
- File: `src/components/CodeBlock.tsx`
- Use `shiki` or `prism-react-renderer` for syntax highlighting
- Copy button on hover
- Language label

### Task 4.3: Typing animation
- File: `src/components/TypingDots.tsx`
- Three dots that fade in/out with stagger
- Used while waiting for first chunk
- After first chunk: stop showing, show the message with a `streaming` cursor

**Acceptance criteria:**
- [ ] User and assistant messages visually distinct
- [ ] Markdown renders correctly (headings, lists, code, bold, italic)
- [ ] Code blocks have syntax highlighting + copy button
- [ ] Typing indicator shows while waiting for first chunk
- [ ] Streaming cursor shows at end of partial response
- [ ] No layout shift as content streams in

---

## 🚧 Phase 5: P0 — Settings UI

**Goal:** The settings window is complete and pleasant. Every setting the user might want to change is here.

**Files:**
- `src/routes/Settings.tsx` — already exists, refactor heavily
- `src/components/SettingRow.tsx` (new)
- `src/components/SettingSection.tsx` (new)
- `src/components/KeyRecorder.tsx` (new) — for rebinding hotkeys
- `src/components/ModelPicker.tsx` (new)
- `src/components/PromptPicker.tsx` (new)
- `src/components/PromptEditor.tsx` (new) — edit a prompt template

**Subagent tasks:**

### Task 5.1: Settings layout
- File: `src/routes/Settings.tsx`
- Sections: General, Hotkeys, AI, Capture, Privacy, About
- Sticky nav on left, content on right
- Dark mode by default

### Task 5.2: Hotkey recorder
- File: `src/components/KeyRecorder.tsx`
- Click to start recording, then capture the next key combo
- "Reset to default" button
- Conflict detection (warn if binding is already used by another action)

### Task 5.3: Prompt editor
- File: `src/components/PromptEditor.tsx`
- Edit any of the 7 templates (or create custom)
- Live preview of the prompt
- "Restore default" button for templates

**Acceptance criteria:**
- [ ] All settings persist (hotkey bindings, model, prompt, API key flag, capture toggles)
- [ ] Settings open via tray menu and via `⌘+Shift+,`
- [ ] Hotkey recorder works for all 7 actions
- [ ] Conflicts are detected and shown
- [ ] Prompt editor saves changes immediately

---

## 🚧 Phase 6: P0 — Screen Capture

**Goal:** `⌘+Shift+S` captures the current screen, attaches it to the next chat message, and the user can ask "what's wrong with this code?" or "summarize this article".

**Files:**
- `src-tauri/src/capture/mod.rs` (new) — module root
- `src-tauri/src/capture/screen.rs` (new) — xcap-based screen capture
- `src-tauri/src/capture/store.rs` (new) — save to captures/, insert DB row
- `src-tauri/Cargo.toml` — add `xcap = "0.0.x"`
- `src-tauri/src/ipc/commands.rs` — add `capture_screen` command
- `src/lib/tauri.ts` — wrapper
- `src/components/CapturePreview.tsx` (new) — shows last capture as a thumbnail in overlay
- `src/components/InputBar.tsx` — camera button sends capture to Gemini

**Subagent tasks:**

### Task 6.1: Screen capture backend
- File: `src-tauri/src/capture/screen.rs`
- Uses `xcap::Monitor::all().capture_image()` to grab the primary monitor
- Returns `RgbaImage`, encode to PNG
- Save to `~/Library/Application Support/com.cluelyhidden.app/captures/{uuid}.png`
- Insert into `captures` table

### Task 6.2: Attach to message
- File: `src-tauri/src/ai/gemini.rs`
- `GeminiClient::send_with_image(text, image_path)`
- Sends text + base64-encoded image to Gemini in one call
- Gemini Vision handles the rest

### Task 6.3: Frontend capture flow
- File: `src/components/CapturePreview.tsx`
- Shows the last capture as a small thumbnail at the top of the chat
- "X" to detach
- File: `src/components/InputBar.tsx`
- Camera button (⌘+Shift+S) captures and attaches
- Auto-sends the next message with image

**Acceptance criteria:**
- [ ] `⌘+Shift+S` captures the primary screen in < 500ms
- [ ] Capture thumbnail shows in overlay
- [ ] Sending a message with capture attached returns a Gemini Vision response
- [ ] User can detach the capture before sending
- [ ] Captures are stored locally, never uploaded automatically

---

## 🚧 Phase 7: P1 — Audio Capture + STT

**Goal:** Push-to-talk voice input. Gemini transcribes audio + responds in one call (multimodal).

**Files:**
- `src-tauri/src/capture/audio.rs` (new) — cpal-based mic capture
- `src-tauri/Cargo.toml` — add `cpal`, `hound`
- `src/components/AudioBar.tsx` (new) — recording UI with waveform

**Subagent tasks:**

### Task 7.1: Mic capture backend
- File: `src-tauri/src/capture/audio.rs`
- `start_recording()` opens mic stream
- `stop_recording()` returns WAV bytes
- Uses cpal for capture, hound for WAV encoding
- Optional VAD for auto-stop (port VAD config from Pluely)

### Task 7.2: Gemini audio input
- File: `src-tauri/src/ai/gemini.rs`
- `GeminiClient::send_with_audio(text, audio_path)` — sends text + audio inline
- Gemini's `gemini-2.0-flash` handles audio natively

### Task 7.3: Frontend audio UI
- File: `src/components/AudioBar.tsx`
- Push-to-talk button (hold to record)
- Waveform visualization during recording
- "Transcribing..." spinner after release
- Auto-sends the transcription + audio to Gemini

**Acceptance criteria:**
- [ ] Hold mic button, speak, release → message sent
- [ ] Waveform animates in real-time
- [ ] Gemini transcribes and responds in < 2s
- [ ] VAD auto-stops if user stops talking for 1s
- [ ] Audio stored locally in captures/

---

## 🚧 Phase 8: P0 — System Audio Capture (Meetings)

**Goal:** `⌘+Shift+M` captures meeting audio (Zoom, Meet, etc.) and feeds it to the AI in real-time.

**Files:**
- `src-tauri/src/capture/system_audio.rs` (new) — ScreenCaptureKit on macOS
- `src-tauri/Cargo.toml` — add `screencapturekit = "0.3"` or use `cpal` with system device

**Subagent tasks:**

### Task 8.1: System audio capture
- File: `src-tauri/src/capture/system_audio.rs`
- On macOS, use `screencapturekit` to capture system audio
- Stream chunks to the AI continuously
- Show a "listening..." indicator in the overlay

### Task 8.2: Real-time AI
- File: `src-tauri/src/ai/gemini.rs`
- `GeminiClient::stream_audio_chunks(stream) -> Stream<response>`
- Gemini's Live API supports real-time audio (v0.5 — for now just buffer and send periodically)

**Acceptance criteria:**
- [ ] `⌘+Shift+M` starts system audio capture
- [ ] Overlay shows a "listening" indicator
- [ ] Gemini processes the audio and provides insights
- [ ] Capture stops cleanly when toggled off

---

## 🚧 Phase 9: P0 — Conversation Persistence

**Goal:** Conversations are searchable, organized, and persist across launches.

**Files:**
- `src-tauri/src/db/conversations.rs` (new)
- `src-tauri/src/db/messages.rs` (new)
- `src/components/HistorySidebar.tsx` (new)
- `src/components/ConversationList.tsx` (new)

**Subagent tasks:**

### Task 9.1: DB CRUD
- Files: `src-tauri/src/db/{conversations,messages}.rs`
- `list_conversations`, `create_conversation`, `delete_conversation`
- `list_messages(conv_id)`, `save_message(msg)`

### Task 9.2: History sidebar
- File: `src/components/HistorySidebar.tsx`
- List of conversations (title = first user message or generated title)
- Click to load
- Delete with confirmation
- Search bar

**Acceptance criteria:**
- [ ] Conversations are saved automatically
- [ ] Reloading the app shows previous conversations
- [ ] User can search conversations
- [ ] User can delete conversations
- [ ] User can rename conversations

---

## 🚧 Phase 10: P1 — Memory + Fact Extraction

**Goal:** After each conversation, Gemini extracts user facts ("User prefers dark mode", "User is interviewing at Google"). These surface in the system prompt of future conversations.

**Files:**
- `src-tauri/src/memory/mod.rs` (new) — memory module
- `src-tauri/src/memory/facts.rs` (new) — fact extraction + storage
- `src-tauri/src/db/memory.rs` (new) — memory_facts table
- `src/lib/MemoryInspector.tsx` (new) — dev tool: see all known facts

**Subagent tasks:**

### Task 10.1: Memory store
- File: `src-tauri/src/memory/facts.rs`
- `extract_facts(conversation_messages) -> Vec<Fact>` — calls Gemini to extract
- `store_facts(facts)`, `list_facts()`, `delete_fact(id)`

### Task 10.2: Inject into system prompt
- File: `src-tauri/src/ai/router.rs`
- Before sending to Gemini, prepend the user's known facts to the system prompt
- Use Gemini's `cachedContent` API for efficient reuse

### Task 10.3: Memory inspector
- File: `src/routes/MemoryInspector.tsx`
- Shows all known facts
- User can edit/delete any
- "This is what the AI knows about you" page

**Acceptance criteria:**
- [ ] After 5+ conversations, the AI starts referencing known facts
- [ ] User can see, edit, and delete facts
- [ ] "Forget everything" button clears all memory

---

## 🚧 Phase 11: P0 — Final Ship

**Goal:** Signed, notarized `.dmg` ready to distribute.

**Subagent tasks:**

### Task 11.1: App icon set
- Generate proper 16/32/128/256/512/1024 PNGs + .icns
- App icon should be slick (not the placeholder C)

### Task 11.2: Code signing
- Configure `tauri.conf.json` with `bundle.macOS.signingIdentity`
- Set `APPLE_ID`, `APPLE_PASSWORD` (app-specific), `APPLE_TEAM_ID` env vars

### Task 11.3: Notarization
- `tauri build` with notarization enabled
- Verify with `spctl --assess`

### Task 11.4: Final QA
- Clean install on a fresh Mac
- All hotkeys work
- All features work
- No console errors
- All prompts selectable
- All settings persist
- Code-signed .dmg installs without "unidentified developer" warning

**Acceptance criteria:**
- [ ] `.dmg` opens
- [ ] Drag-to-Applications works
- [ ] App launches without warnings
- [ ] All features work end-to-end
- [ ] Code-signed + notarized
- [ ] Total binary size < 30MB

---

## Estimated Subagent Count

| Phase | Tasks | Estimated subagent-min |
|---|---|---|
| 1 | 3 | 30 |
| 2 | 4 | 40 |
| 3 | 8 | 80 (parallel) |
| 4 | 3 | 25 |
| 5 | 3 | 30 |
| 6 | 3 | 35 |
| 7 | 3 | 35 |
| 8 | 2 | 30 |
| 9 | 2 | 25 |
| 10 | 3 | 35 |
| 11 | 4 | 40 |
| **Total** | **38** | **~405 subagent-min** |
| **Real time (parallel where possible)** | | **~3-4 hours wall clock** |
