# Execution roadmap — Cluely Hidden

Living backlog derived from [`VISION.md`](./VISION.md). **Status:** v0.5.0 tagged; execution starts at **Sprint A**.

---

## Sprint A (v0.6 foundation) — ~2 weeks

**Goal:** Trustworthy local config + audio path to meetings.

| ID | Work | Owner lane | Acceptance |
|----|------|------------|------------|
| A1 | Gemini key in **Keychain**; `get_settings` returns `geminiApiKeyConfigured` only | Rust | Key survives restart; never in git/logs |
| A2 | `tauri-plugin-store` or SQLite `app_settings` for theme, hotkeys, active profile | Rust + FE | Restart preserves non-secret settings |
| A3 | Persist **live session** turns to `messages` on `ai_stop_live` | Rust + FE | History view shows last live chat |
| A4 | **System audio** spike (ScreenCaptureKit or port cheating-daddy pattern) | Rust | Level meter + optional send to Live |
| A5 | **Transparency** slider + window position save | FE + Rust | Restores on launch |
| A6 | E2E doc `docs/E2E-v0.6.md` | QA | Checklist: key, live, capture, history |

---

## Sprint B (v0.7 overlay 2.0) — ~2 weeks

| ID | Work | Owner lane | Acceptance |
|----|------|------------|------------|
| B1 | **Compact pill** overlay mode (minimal chrome) | UX + FE | Toggle from tray or hotkey |
| B2 | **Screenshot tray** — multi-capture before send (Pluely manual mode) | FE + Rust | 3 screenshots → one prompt |
| B3 | Finish **11 hotkeys** + Settings rebind recorder | Rust + FE | All actions from ARCHITECTURE.md |
| B4 | **Click-through** toggle (⌘+M) | Rust | Mouse passes through overlay |
| B5 | **Stealth tiers** Ghost / Glass / Focus | UX + FE | Cycle hotkey; persists |
| B6 | Provider stub: **Groq Flash** for text-only fallback | Rust | Settings provider pick |

---

## Sprint C (v0.8 dual-brain) — ~2 weeks

| ID | Work | Owner lane | Acceptance |
|----|------|------------|------------|
| C1 | While Live active, **⌘+Enter** → capture + Flash “speakable answer” | Rust + FE | Answer in teleprompter strip |
| C2 | **Response carousel** ⌘+[/] across candidates | FE | Matches cheating-daddy UX |
| C3 | Profile fields: max words, tone | FE + DB | Stored per profile |
| C4 | Mic **VAD** modes (aggressive / balanced / manual) | Rust | Less noise to Live |

---

## Sprint D (v0.9 timeline) — ~2 weeks

| ID | Work | Owner lane | Acceptance |
|----|------|------------|------------|
| D1 | **Session timeline** UI (audio peaks, captures, messages) | FE + UX | Scrub + jump |
| D2 | Export session → Markdown | Rust | One file per conversation |
| D3 | **Emergency erase** optional DB+captures wipe | Rust | User confirms; SECURITY.md updated |

---

## Sprint E (v1.0 exceptional)

| ID | Work | Owner lane | Acceptance |
|----|------|------------|------------|
| E1 | Local **RAG vault** (folder watch + sqlite-vec or similar) | Rust | Query past meetings offline |
| E2 | **Calendar hint** for profile (EventKit, opt-in) | Rust + FE | Suggestion only |
| E3 | Signed + notarized **DMG** in CI/release | QA | Gatekeeper clean |
| E4 | Cluely.com / Pluely **parity audit** doc + gap closure | Research + UX | Director sign-off |

---

## Parallel research (ongoing)

- Pluely `src-tauri` audio/speaker modules (Linux patterns → macOS port ideas).
- Pluely Dev Space cURL provider schema → our `providers/` JSON format.
- cheating-daddy `SystemAudioDump` + Live message shapes.
- Issue tracker: Pluely #190 (model switch overlay), #192 (system prompt in audio capture).

---

## Dispatch order (recommended)

```
Sprint A (A1 → A2 → A3 in parallel lanes where isolated)
    → Sprint B (B1+B5 UX first)
    → Sprint C (dual-brain = differentiator)
    → Sprint D → E
```

**Next commit target:** A1 + A2 (Keychain + persisted settings).

---

## Links

- [VISION.md](./VISION.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [SECURITY.md](./SECURITY.md)
- [RELEASE-v0.5.0.md](./RELEASE-v0.5.0.md)