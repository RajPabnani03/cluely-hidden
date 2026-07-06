# Cluely Hidden — roadmap

## Shipped (Sprints A–B, v0.5.x)

- Stealth overlay, hotkeys, SQLite history, Gemini Live, screen capture, mic pipeline
- Settings persistence, profile sync, session → history on stop

## Sprint C — Dual brain & live UX ✅

See **`docs/SPRINT-C.md`** for usage and verification checklist.

| ID | Item | Status |
|----|------|--------|
| C1 | `dual_brain_step` IPC (capture + flash speakable while Live active) | Done |
| C2 | Teleprompter strip + `ai:speakable` event | Done |
| C3 | Response carousel snapshots + hotkey navigation | Done |
| C4 | Profile `max_words` / `tone` in DB + Settings | Done |
| C5 | Mic VAD modes (`aggressive` / `balanced` / `manual`) + `set_mic_gate` | Done |
| C6 | Screenshot tray context in dual-brain prompt | Done |

## Sprint D — History & privacy ✅

| ID | Item | Status |
|----|------|--------|
| D1 | Session timeline UI in History | Done |
| D2 | Export conversation as Markdown | Done |
| D3 | Emergency erase local data (`wipe_local_data` + hotkey DB wipe) | Done |

## Sprint E — Integrations & release hygiene ✅ (stubs)

| ID | Item | Status |
|----|------|--------|
| E1 | Local RAG vault index/query (folder of `.txt`/`.md`) | Stub |
| E2 | Calendar hints via macOS Calendar (AppleScript) | Stub |
| E3 | CI workflow skeleton + signing doc | Done |
| E4 | Parity audit vs Cluely.com UX | `docs/PARITY-AUDIT.md` |

## Next (v0.6+)

- Keychain for Gemini key, signed DMG when Developer ID cert exists
- Loopback / system audio capture
- FTS5 search for history + vault
- Vision on dual-brain capture (multimodal flash)
- Redact API keys in WebSocket error logs