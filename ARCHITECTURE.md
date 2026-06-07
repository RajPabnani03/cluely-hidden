# Cluely-Hidden — Architecture v0.2.0

> **Mission:** A lightweight, **stealth** AI assistant overlay for macOS. Completely invisible in screen-share, screen recordings, screenshots, and the Dock. Summoned by hotkey, dismissed by hotkey. Powered by Google Gemini. Inspired by Pluely.
>
> **Stack:** Tauri 2.11 + React 18 + TypeScript + Tailwind + Zustand + SQLite (rusqlite) + Gemini API
>
> **Tagline:** "Slick. To the point. Undetectable."

---

## 1. The Three Non-Negotiables (P0)

1. **🔒 Invisible in screen-share** — Zoom, Meet, Teams, Discord, QuickTime, macOS screenshot. Uses `content_protected(true)` on macOS.
2. **👻 Hidden from Dock + Cmd+Tab** — `skip_taskbar(true)`, no `LSUIElement: false`. Tray icon is the only presence.
3. **⚡ Hotkey-only** — `⌘+Shift+Space` shows, same again hides. No window in app switcher when hidden.

## 2. What We Steal From Pluely

| Feature | Pluely impl | Our impl |
|---|---|---|
| `content_protected(true)` | ✅ in `window.rs:create_dashboard_window` | ✅ port verbatim |
| Multi-hotkey dispatch | ✅ in `shortcuts.rs:handle_shortcut_action` | ✅ port action_id pattern |
| 7 system prompts | ✅ in `lib/platform-instructions.ts` | ✅ port all 7 verbatim |
| AI provider plugin (curl templates) | ✅ in `config/ai-providers.constants.ts` | ✅ port + add Gemini explicitly |
| VAD-based push-to-talk | ✅ in `hooks/useSystemAudio.ts` | ✅ port VAD config |
| Screen capture overlay | ✅ in `capture.rs` (xcap) | ✅ port xcap usage |
| Tauri-nspanel for macOS | ✅ | ❌ skip — too heavy, we use WebviewWindow |
| License/activation system | ✅ | ❌ skip — we're open source, no payment |

## 3. Tech Stack (Locked)

| Layer | Choice | Notes |
|---|---|---|
| Shell | Tauri 2.11 (Rust) | macos-private-api, tray-icon, image-png features |
| UI | React 18 + TypeScript + Vite | Same as Pluely |
| Styling | Tailwind 3 + shadcn-style tokens | Dark-mode first |
| State | Zustand 5 | Tiny, no boilerplate |
| DB | SQLite via rusqlite (bundled) | Conversations, prompts, captures |
| AI | **Google Gemini API** (gemini-2.0-flash default) | Via OpenAI-compat endpoint OR native |
| HTTP | reqwest (Rust) | For Gemini streaming |
| Capture | xcap (Rust) | Cross-platform screen capture |
| Hotkeys | tauri-plugin-global-shortcut | Native |
| Tray | tauri::tray (core) | No separate plugin |
| Streaming | Server-Sent Events from Gemini | Or just chunked HTTP |

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  macOS Desktop                                                      │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  cluely-hidden.app  (Tauri 2 / Rust core)                     │  │
│  │                                                               │  │
│  │  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐  │  │
│  │  │ Tray Icon    │  │ Overlay Window │  │ Settings Window  │  │  │
│  │  │ (NSStatus)   │  │ (Webview)      │  │ (Webview)        │  │  │
│  │  │              │  │ content-       │  │ (when opened)    │  │  │
│  │  │              │  │ protected=true │  │                  │  │  │
│  │  └──────┬───────┘  └────────┬───────┘  └────────┬─────────┘  │  │
│  │         │                   │ Tauri IPC (typed) │            │  │
│  │         └───────────────────┼───────────────────┘            │  │
│  │                             ▼                                │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  Rust Core                                            │   │  │
│  │  │  ┌────────────┐ ┌──────────────┐ ┌────────────────┐  │   │  │
│  │  │  │ Hotkey Mgr │ │ Window Mgr   │ │ Capture Mgr    │  │   │  │
│  │  │  │ (7 actions)│ │ (show/hide)  │ │ (xcap + audio) │  │   │  │
│  │  │  └────────────┘ └──────────────┘ └────────────────┘  │   │  │
│  │  │  ┌────────────┐ ┌──────────────┐ ┌────────────────┐  │   │  │
│  │  │  │ AI Router  │ │ Memory Store │ │ Prompt Engine  │  │   │  │
│  │  │  │ (Gemini)   │ │ (SQLite)     │ │ (7 templates)  │  │   │  │
│  │  │  └────────────┘ └──────────────┘ └────────────────┘  │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  └────────────────────────┬────────────────────────────────────┘  │
│                           │                                        │
│                           ▼                                        │
│   ┌─────────────────────────────────────────┐                      │
│   │ Google Gemini API                       │                      │
│   │ (generativelanguage.googleapis.com)     │                      │
│   │  • gemini-2.0-flash (default)           │                      │
│   │  • gemini-2.0-flash-thinking (smart)    │                      │
│   │  • gemini-2.5-pro (best)                │                      │
│   └─────────────────────────────────────────┘                      │
│                                                                    │
│   ~/Library/Application Support/com.cluelyhidden.app/              │
│    ├── secure_storage.json    (Gemini API key, settings)           │
│    ├── conversations.db       (SQLite: msgs, facts)                 │
│    ├── captures/              (PNGs, WAVs — opt-in)                │
│    └── prompts/               (user-edited prompt templates)       │
└────────────────────────────────────────────────────────────────────┘
```

## 5. The Hotkey System (7 Actions)

| Action ID | Default Hotkey | What it does |
|---|---|---|
| `toggle_overlay` | `⌘+Shift+Space` | Show/hide the main overlay |
| `open_settings` | `⌘+Shift+,` | Open settings window |
| `screenshot` | `⌘+Shift+S` | Capture screen + send to AI |
| `audio_toggle` | `⌘+Shift+A` | Start/stop voice recording |
| `audio_system` | `⌘+Shift+M` | Toggle system audio capture (v0.4) |
| `focus_input` | `⌘+Shift+I` | Bring overlay forward, focus the input |
| `move_window` | `⌘+arrows` | Hold ⌘ and press arrows to reposition |

The action_id dispatch pattern (from Pluely) is the way: every registered shortcut has an action_id, the handler dispatches by action_id, the frontend can also subscribe to action events for custom UI.

## 6. The 7 System Prompts (Ported from Pluely)

1. **real_time_translator** — "Listen and translate"
2. **meeting_assistant** — "Listen, summarize, action items"
3. **interview_assistant** — "Answer interview Q's with my resume + JD context"
4. **technical_interview** — "Coding/system design hints"
5. **presentation_coach** — "Delivery, talking points, confidence"
6. **learning_companion** — "Explain concepts, suggest questions"
7. **customer_service** — "Quick responses, solutions, talking points"

Each prompt is editable in the UI. Stored in SQLite.

## 7. Stealth Checklist (P0)

| Requirement | How |
|---|---|
| Invisible in screen-share | `.content_protected(true)` on overlay window |
| Hidden from Dock | `.skip_taskbar(true)` + `app.set_activation_policy(Accessory)` |
| Hidden from Cmd+Tab | Same as above — accessory apps don't appear |
| Not in macOS screenshots | `content_protected(true)` covers this |
| Not in screen recordings | `content_protected(true)` covers this |
| Process hidden in Activity Monitor | ❌ Not possible (Mac shows all processes). We make the WINDOW invisible, not the process. |
| No log entries revealing the app | All paths under `~/Library/Application Support/com.cluelyhidden.app/` |
| Tray icon only presence | `.icon_as_template(true)` for menu bar adaption |

## 8. IPC Contract

```typescript
// Window
toggle_overlay(): void
open_settings(): void
move_window(direction: "up"|"down"|"left"|"right", step: number): void
set_click_through(enabled: boolean): void

// Capture
capture_screen(): { id, path, width, height }
start_audio_capture(): void
stop_audio_capture(): { id, path, duration_ms, transcript? }

// AI (Gemini)
chat_stream(input: ChatInput): AsyncIterable<ChatChunk>  // SSE
list_models(): ModelInfo[]
get_active_prompt(): SystemPrompt
set_active_prompt(id: string): void

// Prompts
list_prompts(): SystemPrompt[]
create_prompt(input: PromptInput): SystemPrompt
update_prompt(id: string, patch: PromptInput): SystemPrompt
delete_prompt(id: string): void

// Conversations
list_conversations(): Conversation[]
create_conversation(): Conversation
list_messages(conversationId: string): Message[]
save_message(message: Message): void
delete_conversation(id: string): void

// Settings
get_settings(): AppSettings
update_settings(patch: Partial<AppSettings>): AppSettings
set_api_key(key: string): void         // stored in secure_storage.json
has_api_key(): boolean
validate_api_key(): { valid: boolean, error?: string }

// Events (Rust → JS)
"overlay:visibility" → boolean
"audio:level" → number               // 0.0-1.0 for waveform UI
"audio:transcript" → string          // partial STT
"shortcut:triggered" → { action: string }
"capture:complete" → { id, path }
```

## 9. Data Model (SQLite)

```sql
-- Conversations
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  prompt_id TEXT REFERENCES prompts(id),
  created_at INTEGER,
  updated_at INTEGER
);

-- Messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  role TEXT CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT,
  created_at INTEGER,
  tokens_used INTEGER,
  model TEXT,
  attachments TEXT  -- JSON array of file refs
);

-- User prompts (the 7 templates + custom)
CREATE TABLE prompts (
  id TEXT PRIMARY KEY,
  name TEXT,
  prompt TEXT,
  is_template INTEGER DEFAULT 0,  -- 1 = built-in, 0 = user-created
  created_at INTEGER,
  updated_at INTEGER
);

-- Captures (opt-in)
CREATE TABLE captures (
  id TEXT PRIMARY KEY,
  kind TEXT CHECK(kind IN ('screen', 'audio')),
  file_path TEXT,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  created_at INTEGER,
  conversation_id TEXT REFERENCES conversations(id)
);

-- Settings (in addition to secure_storage.json)
-- Stored as key-value for flexibility
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT  -- JSON
);
```

## 10. Phased Delivery (Revised)

| Phase | Focus | Deliverable |
|---|---|---|
| **0** ✅ | Scaffold + working hello-world | Done (commit 2728b44) |
| **0b** ✅ | Stealth + working .app | Done (commit afd1633) |
| **1** | **P0: Maximum stealth** | `content_protected`, Accessory policy, hidden from Cmd+Tab, no Dock icon, click-through |
| **2** | **P0: Multi-hotkey system** | 7 hotkeys with action_id dispatch, rebindable from settings |
| **3** | **P0: Real Gemini integration** | Streaming chat, API key in secure storage, model picker, 7 prompt templates |
| **4** | **P0: Chat UI polish** | Markdown rendering, code blocks, streaming animation, message history |
| **5** | **P0: Settings UI** | Hotkey rebinding, model picker, prompt editor, capture toggles, API key input |
| **6** | **P0: Screen capture** | `⌘+Shift+S` captures screen → auto-attaches to next message |
| **7** | **P1: Audio capture + STT** | Push-to-talk, waveform, VAD, Gemini transcribes audio |
| **8** | **P0: System audio capture** | Captures meeting audio (ScreenCaptureKit) |
| **9** | **P0: Conversation persistence** | SQLite, history sidebar, search |
| **10** | **P1: Memory + fact extraction** | Gemini extracts user facts from conversations, surfaces them in responses |
| **11** | **P0: Final ship** | Signed .dmg, notarized, polished |

## 11. Performance Budget

| Metric | Target |
|---|---|
| App cold start (cached) | < 500ms |
| Hotkey → overlay visible | < 100ms |
| Overlay first paint (Vite) | < 300ms |
| Idle RAM (overlay hidden) | < 40MB |
| Idle RAM (overlay visible) | < 100MB |
| First Gemini token (gemini-2.0-flash) | < 800ms |
| Streaming tokens/sec | > 50 |
| Screen capture + encode | < 200ms |
| Audio capture latency | < 50ms |

## 12. Security & Privacy

- **API key in `~/Library/Application Support/com.cluelyhidden.app/secure_storage.json`** — never logged, never sent anywhere except Gemini
- **No telemetry, no analytics**
- **Screen captures stored locally** — never uploaded unless user explicitly shares in chat
- **Audio recordings stored locally** — same rule
- **All conversations in local SQLite** — never synced
- **macOS sandbox:** Not sandboxed (we need global hotkeys + screen capture). Notarized for distribution.
- **Permissions requested:** Accessibility (hotkeys), Screen Recording (capture), Microphone (audio)

## 13. Why Gemini

- **Multimodal native** — text + images + audio in one call (perfect for screenshots + voice)
- **Fast (gemini-2.0-flash)** — 50+ tok/s
- **Smart (gemini-2.5-pro)** — when you need it
- **Free tier is generous** — 15 RPM, 1M TPM, 1500 RPD
- **API key from AI Studio** — `aistudio.google.com/apikey` — one click, free
- **No vendor lock-in for prompts** — same prompts work with OpenAI/Claude if user adds their key later
