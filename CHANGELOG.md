# Changelog

All notable changes to **Cluely Hidden** are documented here.

## [0.5.0] — 2026-03-28

### What's new

- **Gemini Live** — real-time voice + text via WebSocket (`ai_start_live_configured`, mic pipeline, screen capture).
- **Cluely-style overlay** — floating card, recording pill, hotkey hints, screenshot preview.
- **Microphone** — cpal capture → 24 kHz PCM → Live session; VU meter + `mic:level` events.
- **Streaming UX** — typing dots, blinking caret, live text in main ChatStream.
- **History** — SQLite conversations: list, search, load, delete.
- **Settings** — Gemini API key + “Use for live” profile selection (no demo key).
- **11 global hotkeys** — overlay, screenshot, emergency erase, navigation, scroll (see Help).
- **Stealth** — `content_protected`, no dock/skip taskbar; invisible in screen-share (macOS private API).

### What's fixed

- Rust mic pipeline: Send-safe capture thread (no `cpal::Stream` on async state).
- Live session starts from stored settings + profile `system_prompt`.

### Upgrade notes

- Set **Settings → Model → Gemini API key** before **Start session**.
- Pick a profile under **Settings → Profiles → Use for live**.
- **Unsigned build** — this release is not code-signed; use `npm run tauri:dev` or local `tauri:build` on your machine. Signing deferred to a later release.

### Known limitations

- Settings are in-memory until store persistence is wired (restart may clear API key until re-entered).
- System/meeting loopback audio not included (mic input only).
- Ollama/Groq providers still planned.

## [0.3.0] — earlier

- SQLite DB, 7-view shell, 6 builtin profiles, stealth overlay foundation.