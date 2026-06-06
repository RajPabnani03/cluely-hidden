# Cluely-Hidden — Architecture

> **Mission:** A lightweight, stealth AI assistant overlay for macOS. Always there, never in the way, learns from you.
> **Codename:** `cluely-hidden`
> **Tagline:** "Slick. To the point. Yours."

---

## 1. Product Principles

1. **Stealth by default** — invisible until summoned (⌘+Shift+Space), never steals focus, never logs keystrokes it doesn't need.
2. **Local-first, private by design** — your data never leaves the machine unless you explicitly ask.
3. **Grows on your data** — every interaction enriches the local memory graph; the assistant gets smarter about *you* over time.
4. **Slick, not showy** — fewer animations, sharper typography, native macOS feel.
5. **One binary, one process** — no Electron-style bloat. Tauri 2 keeps us under 15MB.

---

## 2. Tech Stack (Locked)

| Layer | Choice | Why |
|---|---|---|
| **Shell / Native** | Tauri 2 (Rust) | 5-15MB binary, native macOS APIs, no Chromium bundled |
| **UI** | React 18 + TypeScript + Vite | Hot reload, type safety, huge ecosystem |
| **Styling** | Tailwind CSS + shadcn/ui | Fast, consistent, dark-mode-first |
| **State** | Zustand | Tiny (~1KB), no boilerplate |
| **Local DB** | SQLite via `rusqlite` (Rust) + Drizzle ORM (TS) | Structured memory, vector search via `sqlite-vss` |
| **Embeddings** | `fastembed-rs` (Rust bindings for fastembed) | Local embeddings, no API call |
| **LLM (local)** | Ollama (HTTP) — `llama3.2:3b` for fast, `llama3.1:8b` for smart | Free, private, runs on Apple Silicon natively |
| **LLM (cloud, optional)** | OpenAI-compatible API endpoint | User-provided key, opt-in only |
| **Screen capture** | macOS ScreenCaptureKit via Tauri plugin | Native, low overhead, captures any window |
| **Audio capture** | `cpal` (Rust) + `whisper-rs` for STT | Local, private speech-to-text |
| **Global hotkey** | `tauri-plugin-global-shortcut` | Native hotkey registration |
| **Tray icon** | `tauri-plugin-tray` | Menu bar presence |
| **Packaging** | `tauri build` → `.app` → `create-dmg` → signed + notarized | Standard macOS distribution |
| **CI** | GitHub Actions (later) | For now: local builds |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  macOS Desktop                                                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  cluely-hidden.app  (Tauri 2 / Rust core)                │   │
│  │                                                          │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │ Tray Icon   │  │ Overlay Win  │  │ Settings Win   │  │   │
│  │  │ (NSStatus)  │  │ (Webview)    │  │ (Webview)      │  │   │
│  │  └─────┬───────┘  └──────┬───────┘  └────────┬───────┘  │   │
│  │        │                 │                   │          │   │
│  │        └────────┬────────┴───────────────────┘          │   │
│  │                 │  Tauri IPC (typed events)              │   │
│  │                 ▼                                        │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  Rust Core Services                              │   │   │
│  │  │  ┌────────────┐ ┌────────────┐ ┌──────────────┐  │   │   │
│  │  │  │ Hotkey Mgr │ │ Window Mgr │ │ Capture Mgr  │  │   │   │
│  │  │  └────────────┘ └────────────┘ └──────────────┘  │   │   │
│  │  │  ┌────────────┐ ┌────────────┐ ┌──────────────┐  │   │   │
│  │  │  │ Audio Mgr  │ │ AI Router  │ │ Memory Store │  │   │   │
│  │  │  └────────────┘ └────────────┘ └──────────────┘  │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                 │                                        │   │
│  └─────────────────┼────────────────────────────────────────┘   │
│                    │                                            │
│   ┌────────────────┼─────────────────┐                          │
│   ▼                ▼                 ▼                          │
│  ~/Library/     Ollama          Hermes Agent                    │
│  Application    (localhost:    (optional, v0.3)                 │
│  Support/       11434)                                          │
│  cluely-                                                         │
│  hidden/                                                         │
│   ├── db.sqlite                                                  │
│   ├── embeddings/                                                │
│   └── memory/                                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Model (SQLite)

```sql
-- Conversations
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  context_window INTEGER DEFAULT 10
);

-- Messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  role TEXT CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT,
  created_at INTEGER,
  tokens_used INTEGER,
  source TEXT  -- 'hotkey', 'text', 'voice', 'screen'
);

-- Memory facts (the "grows on your data" part)
CREATE TABLE memory_facts (
  id TEXT PRIMARY KEY,
  fact TEXT,
  category TEXT,           -- 'preference', 'fact', 'pattern', 'project'
  confidence REAL,         -- 0.0-1.0
  embedding BLOB,          -- 384-dim float vector
  first_seen INTEGER,
  last_reinforced INTEGER,
  reinforce_count INTEGER DEFAULT 1
);

-- Vector search via sqlite-vss
CREATE VIRTUAL TABLE memory_fts USING vss0(
  embedding(384)
);

-- Captures (screen/audio) — stored only if user opts in
CREATE TABLE captures (
  id TEXT PRIMARY KEY,
  kind TEXT CHECK(kind IN ('screen', 'audio')),
  file_path TEXT,
  duration_ms INTEGER,
  created_at INTEGER,
  processed INTEGER DEFAULT 0  -- 1 = text extracted, embedding made
);
```

---

## 5. Module Breakdown (Rust Core)

```
src-tauri/src/
├── main.rs                  # entry, builds tauri::Builder
├── lib.rs                   # re-exports
├── config.rs                # paths, env, feature flags
├── error.rs                 # AppError type, Result alias
│
├── window/
│   ├── mod.rs
│   ├── overlay.rs           # creates + manages overlay window
│   ├── settings.rs          # settings window
│   └── helpers.rs           # show/hide, focus, position
│
├── input/
│   ├── mod.rs
│   ├── hotkey.rs            # global shortcut registration
│   └── tray.rs              # NSStatusItem menu
│
├── capture/
│   ├── mod.rs
│   ├── screen.rs            # ScreenCaptureKit wrapper
│   └── audio.rs             # cpal microphone capture
│
├── ai/
│   ├── mod.rs
│   ├── router.rs            # decides local vs cloud, model selection
│   ├── ollama.rs            # Ollama HTTP client
│   ├── openai_compat.rs     # optional cloud fallback
│   ├── embeddings.rs        # fastembed wrapper
│   └── prompts.rs           # system prompts, templates
│
├── memory/
│   ├── mod.rs
│   ├── store.rs             # SQLite CRUD
│   ├── facts.rs             # fact extraction + reinforcement
│   └── search.rs            # vector + FTS search
│
├── ipc/
│   ├── mod.rs
│   └── commands.rs          # #[tauri::command] handlers
│
└── util/
    ├── mod.rs
    ├── paths.rs             # ~/Library/Application Support/cluely-hidden
    └── tokens.rs            # token counting (tiktoken-rs)
```

---

## 6. Frontend Structure (React)

```
src/
├── main.tsx                 # entry
├── App.tsx                  # router
├── routes/
│   ├── Overlay.tsx          # main stealth overlay UI
│   ├── Settings.tsx         # settings panel
│   └── Onboarding.tsx       # first-run wizard
│
├── components/
│   ├── ui/                  # shadcn primitives
│   ├── ChatStream.tsx       # streaming message display
│   ├── InputBar.tsx         # text + voice input
│   ├── CapturePreview.tsx   # shows last screen/audio capture
│   └── MemoryInspector.tsx  # dev tool: see what AI knows about you
│
├── lib/
│   ├── tauri.ts             # typed IPC wrappers (invoke, listen)
│   ├── store.ts             # zustand stores
│   └── utils.ts
│
└── styles/
    └── globals.css          # tailwind + custom
```

---

## 7. IPC Contract (TypeScript ↔ Rust)

```typescript
// src/lib/tauri.ts
export interface CluelyAPI {
  // Window control
  toggleOverlay(): Promise<void>;
  hideOverlay(): Promise<void>;
  setClickThrough(enabled: boolean): Promise<void>;

  // Capture
  captureScreen(): Promise<{ id: string; path: string; width: number; height: number }>;
  startAudioCapture(): Promise<void>;
  stopAudioCapture(): Promise<{ id: string; transcript: string }>;

  // AI
  chat(conversationId: string, message: string, context?: CaptureContext): Promise<AsyncIterable<ChatChunk>>;
  searchMemory(query: string, limit?: number): Promise<MemoryFact[]>;

  // Memory
  listMemoryFacts(category?: string): Promise<MemoryFact[]>;
  deleteMemoryFact(id: string): Promise<void>;
  reinforceMemoryFact(id: string): Promise<void>;

  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
}
```

---

## 8. Performance Budget

| Metric | Target |
|---|---|
| App cold start (warm cache) | < 500ms |
| Overlay show latency (hotkey → visible) | < 100ms |
| Idle RAM (overlay hidden) | < 50MB |
| Idle RAM (overlay visible) | < 120MB |
| Binary size (uncompressed) | < 15MB |
| Binary size (DMG) | < 25MB |
| First-token latency (local 3B model) | < 800ms |
| Streaming tokens/sec (M2 Pro) | > 30 tok/s |

---

## 9. Security & Privacy

- **No network calls by default** — all AI inference is local (Ollama) unless user explicitly enables cloud provider with their own key.
- **No global keystroke logging** — we only capture input when overlay is open AND the input field is focused.
- **Screen capture is explicit** — one-time macOS TCC permission, then per-capture consent via the overlay UI.
- **Audio capture is opt-in** — toggled in settings, never on by default.
- **All data stays in `~/Library/Application Support/cluely-hidden/`** — no telemetry, no analytics, no auto-update pings.
- **Memory facts are user-visible and user-deletable** — `MemoryInspector` UI shows everything the AI has learned.

---

## 10. Phased Delivery

| Phase | Deliverable | What works |
|---|---|---|
| **1** | Project skeleton + working `.dmg` | Empty app launches, has tray icon, can be installed/uninstalled |
| **2** | Stealth overlay | ⌘+Shift+Space shows/hides transparent always-on-top window |
| **3** | Tray menu + settings | Right-click tray for menu; settings window for hotkey, theme, model |
| **4** | Screen + audio capture | ⌘+Shift+S captures screen, ⌘+Shift+A starts audio, text extracted |
| **5** | Chat UI | Send messages, see responses (stubbed for now), conversation history |
| **6** | Settings + storage | SQLite persistence, settings panel, onboarding flow |
| **7** | Hermes/Ollama brain | Real AI responses, memory fact extraction, vector search |
| **8** | Ship | Signed, notarized, polished `.dmg` ready to install |

Each phase ends with a working `.dmg` you can install and use.

---

## 11. Open Questions / Future

- iOS companion? (Tauri Mobile is alpha, skip for v1)
- Multi-monitor awareness for overlay positioning
- Plugin system for user-built "skills" (Hermes-style)
- Onboarding data import (Notion, Obsidian, etc.)
- Cloud sync of memory across user's devices (E2E encrypted)
