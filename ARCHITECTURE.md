# Cluely-Hidden — Architecture v0.3.0

> **Mission:** A lightweight, **stealth** AI assistant for macOS. Invisible in screen-share, invisible in the Dock, summoned by hotkey. Real-time audio (Gemini Live), screenshot-driven workflow, emergency erase. Inspired by cheating-daddy (5.3k⭐) and Pluely.
>
> **Stack:** Tauri 2.11 + React 18 + TypeScript + Tailwind + Zustand + SQLite + Google Gemini Live + Ollama (local fallback)
>
> **Tagline:** "Slick. Real-time. Undetectable. Yours."

---

## 1. The Five Non-Negotiables (P0)

1. **🔒 Invisible in screen-share** — `content_protected(true)` → Zoom/Meet/Teams/Discord/screenshots/recordings
2. **👻 Hidden from Dock + Cmd+Tab** — Accessory policy + `setHiddenInMissionControl(true)`
3. **⚡ Real-time** — Gemini Live WebSocket for sub-300ms response time
4. **🆘 Emergency erase** — One hotkey (⌘+Shift+E) hides window, closes AI session, wipes local data, quits
5. **⌨️ Screenshot-driven UX** — ⌘+Enter takes screenshot, AI responds, user reads answer

## 2. Sources of Inspiration

| App | Stars | Stack | What we steal |
|---|---|---|---|
| **cheating-daddy** (sohzm) | 5.3k | Electron + Lit | Gemini Live, 11 hotkeys, 6 profiles, emergency erase, screenshot-driven UX, VAD, 2-model arch (Live listen → fast respond) |
| **pluely** (iamsrikanthnani) | 2k | Tauri + React | The stealth Tauri 2 API calls (`content_protected`, `title_bar_style(Overlay)`, `hidden_title`), 7 prompt templates pattern, xcap |
| **cluely.com** | — | — | The original positioning (stealth interview assistant) |

## 3. Tech Stack (Locked)

| Layer | Choice | Notes |
|---|---|---|
| Shell | Tauri 2.11 (Rust) | `macos-private-api`, `tray-icon`, `image-png` features |
| UI | React 18 + TypeScript + Vite | shadcn/ui, dark-mode first |
| State | Zustand 5 | Per-view slices |
| DB | SQLite (rusqlite, bundled) | Conversations, settings, profiles |
| AI (primary) | **Google Gemini Live** (`@google/genai` v1.2) | Real-time audio, sub-300ms |
| AI (respond) | **Google Gemini Flash** OR Groq OR Ollama (local) | Pluggable |
| HTTP | reqwest + rust-native-tungstenite (WS for Live) | |
| Audio | `cpal` (Rust) + `hound` (WAV) | Mic capture |
| System audio (macOS) | `screencapturekit` (Rust) | Port from cheating-daddy's `SystemAudioDump` approach |
| Screen | `xcap` (Rust) | Port from Pluely |
| Hotkeys | `tauri-plugin-global-shortcut` | 11 actions |
| Tray | `tauri::tray` (core) | |
| Markdown | `react-markdown` + `remark-gfm` + `shiki` | Same as Pluely pattern |
| Storage (secrets) | `~/Library/Application Support/com.cluelyhidden.app/secure_storage.json` | 0600 perms |
| VAD | Port Pluely's RMS-based VAD with 4 modes | |
| Resampling | Port cheating-daddy's 24k→16k linear interpolation | |

## 4. The 11 Hotkeys (from cheating-daddy, ported)

| Action ID | Default Hotkey | What it does |
|---|---|---|
| `toggle_visibility` | **`⌘+\\`** | Show/hide the window (not `⌘+Shift+Space` — backslash is more unique) |
| `next_step` | `⌘+Enter` | Context-sensitive: starts session OR takes screenshot for AI analysis |
| `emergency_erase` | **`⌘+Shift+E`** | **Panic button**: hide window, close AI, wipe local data, quit |
| `toggle_click_through` | `⌘+M` | Make overlay ignore mouse (or capture it) |
| `move_up` | `Alt+↑` | Move window up 10% of screen |
| `move_down` | `Alt+↓` | Move window down |
| `move_left` | `Alt+←` | Move window left |
| `move_right` | `Alt+→` | Move window right |
| `previous_response` | `⌘+[` | Cycle to previous AI response in this session |
| `next_response` | `⌘+]` | Cycle to next AI response |
| `scroll_up` | `⌘+Shift+↑` | Scroll response area up |
| `scroll_down` | `⌘+Shift+↓` | Scroll response area down |

All rebindable from Settings.

## 5. The 6 Prompt Profiles (from cheating-daddy, ported)

1. **interview** — "AI-powered interview teleprompter. Concise, ready-to-speak answers."
2. **sales** — "Exact words the salesperson should say to prospects."
3. **meeting** — "Exact words to say during professional meetings."
4. **presentation** — "Exact words the presenter should say."
5. **negotiation** — "Exact words during business negotiations."
6. **exam** — "Direct, accurate answers to exam questions."

Each profile is editable. Custom profiles can be created. Stored in SQLite.

The system prompt structure (from cheating-daddy):
```
{intro}
{formatRequirements}
{searchUsage}     // only if Google Search enabled
{content}          // with examples
User-provided context
-----
{customPrompt}
-----
{outputInstructions}
```

## 6. The 2-Model AI Architecture (from cheating-daddy)

```
┌─────────────────────────────────────────────────────────────┐
│  macOS Desktop                                              │
│                                                             │
│  ┌──────────────────────┐                                  │
│  │  User speaks         │                                  │
│  │  (mic + system audio)│                                  │
│  └──────────┬───────────┘                                  │
│             ▼                                              │
│  ┌──────────────────────┐    ┌──────────────────────────┐  │
│  │  cpal / scaudiokit   │───▶│  Gemini Live (WebSocket) │  │
│  │  capture + VAD       │    │  model: gemini-live-2.5  │  │
│  └──────────────────────┘    │  - real-time audio       │  │
│                              │  - speaker diarization    │  │
│                              │  - transcription         │  │
│                              └─────────────┬────────────┘  │
│                                            │              │
│                            on generationComplete           │
│                                            ▼              │
│                              ┌──────────────────────────┐  │
│                              │  Fast Response LLM       │  │
│                              │  (Groq / Gemma / Flash)  │  │
│                              │  ~200ms response time    │  │
│                              └─────────────┬────────────┘  │
│                                            │              │
│                                            ▼              │
│                              ┌──────────────────────────┐  │
│                              │  Stealth overlay UI      │  │
│                              │  streams response in     │  │
│                              │  real-time               │  │
│                              └──────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key insight:** Gemini Live is the LISTENER (real-time WebSocket, persistent, ~free), but the RESPONDER is a separate fast LLM (~200ms). This decouples "I heard you" from "here's my answer" and gives sub-300ms total latency.

## 7. The View Architecture (from cheating-daddy)

Single window, multiple "views" switched via state — not React Router (cheating-daddy uses Lit). We use React state.

| View | Purpose |
|---|---|
| `MainView` | Landing/profile selection/API key entry |
| `AssistantView` | The live assistant (status, transcription, responses, screenshots) |
| `OnboardingView` | First-run wizard (4 steps) |
| `CustomizeView` | Appearance, themes, font size, transparency |
| `AICustomizeView` | Profile editor, model selection, Google Search toggle, custom prompt |
| `HistoryView` | Past sessions (search, replay, delete) |
| `HelpView` | Documentation |
| `FeedbackView` | Send feedback (mailto: or web form) |

Single window, no separate settings window. Settings are a view. The overlay toggle hides/shows the entire window.

## 8. The Storage Layout

```
~/Library/Application Support/com.cluelyhidden.app/
├── secure_storage.json         # API keys (0600)
├── cluely.db                   # SQLite: conversations, messages, profiles, settings
├── captures/                   # PNG screenshots, WAV audio
└── logs/                       # app logs (rotated)
```

**SQLite schema** (conversations + profiles):

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  profile_id TEXT REFERENCES profiles(id),
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  role TEXT CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT,
  audio_transcript TEXT,        -- Gemini's input transcription
  screenshot_id TEXT REFERENCES captures(id),
  created_at INTEGER,
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  name TEXT,
  system_prompt TEXT,
  is_builtin INTEGER DEFAULT 0,
  position INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE captures (
  id TEXT PRIMARY KEY,
  kind TEXT CHECK(kind IN ('screen', 'audio')),
  file_path TEXT,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  created_at INTEGER
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT  -- JSON
);

-- On first launch, seed with 6 builtin profiles from cheating-daddy
```

## 9. The Stealth Layer (deeper than Pluely)

| macOS API | Tauri 2 equivalent | Source |
|---|---|---|
| `NSWindow.sharingType = .none` | `.content_protected(true)` | Pluely |
| `LSUIElement = true` (no Dock) | `app.set_activation_policy(Accessory)` | Both |
| Hidden from Mission Control | `setHiddenInMissionControl` (Electron) → ??? in Tauri | Cheating-daddy |
| Hidden from Cmd+Tab | Accessory policy covers this | Both |
| Invisible in screenshots | `content_protected(true)` covers this | Pluely |
| `setVisibleOnAllWorkspaces` | Tauri: set on all workspaces via `set_visible_on_all_workspaces(true)` | Cheating-daddy |
| Invisible in fullscreen | `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` | Cheating-daddy |

**TBD:** How to do `setHiddenInMissionControl` in Tauri 2. May need raw `objc2` call. If too complex, skip (Mission Control exposure is minor).

## 10. Phased Delivery (10 phases)

| Phase | Focus | Deliverable |
|---|---|---|
| **0** ✅ | Scaffold + hello-world | Done (commit 2728b44) |
| **1** ✅ | P0 stealth (content_protected, Accessory) | Done (commit 9f56263) |
| **2** | **P0 11-hotkey system + emergency erase** | Replace single hotkey, add 11 actions, panic button |
| **3** | **P0 view architecture + 6 profiles** | Onboarding, Main, Assistant, Customize, AI Customize, History, Help views. 6 builtin profiles seeded to DB. |
| **4** | **P0 Gemini Live integration** | Real-time audio, speaker diarization, streaming response |
| **5** | **P0 Screenshot-driven UX** | ⌘+Enter takes screenshot, attaches to message, response streams |
| **6** | **P0 Emergency erase** | ⌘+Shift+E wires up the panic button |
| **7** | **P1 System audio capture** | Capture meeting audio, transcribe, feed to AI |
| **8** | **P1 Fallback providers** | Ollama (local) + Groq (cloud) — pluggable |
| **9** | **P0 Conversation history + persistence** | SQLite CRUD, HistoryView |
| **10** | **P0 Final ship** | App icon, code signing, notarization, polished .dmg |

## 11. Performance Budget

| Metric | Target |
|---|---|
| App cold start (cached) | < 400ms |
| Hotkey → overlay visible | < 80ms |
| Gemini Live first connect | < 1.5s |
| First response token (Live + Groq) | < 500ms |
| Screenshot capture + encode | < 200ms |
| Streaming tokens/sec | > 50 |
| Idle RAM (overlay hidden) | < 35MB |
| Idle RAM (overlay visible, no AI) | < 80MB |
| Active RAM (Live + Groq responding) | < 200MB |
| Binary size (uncompressed) | < 15MB |
| DMG size | < 25MB |

## 12. Security & Privacy

- **API keys** in `secure_storage.json` with 0600 perms. Never logged, never sent anywhere except Gemini/Groq.
- **No telemetry, no analytics, no auto-update pings.**
- **Captures stored locally**, never uploaded automatically. Only attached to a chat message if user clicks send.
- **Conversations in local SQLite**, never synced.
- **Emergency erase** (⌘+Shift+E): closes Gemini session, clears the in-memory conversation state, hides window, quits app. SQLite history is preserved (user can review later) but the live session is gone.
- **macOS sandboxing:** not sandboxed (need global hotkeys + screen recording). Notarized for distribution.
- **Permissions requested:** Accessibility (hotkeys), Screen Recording (capture), Microphone (audio).
