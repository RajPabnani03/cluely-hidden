# Cluely Hidden — Product Vision (2026)

**North star:** The best **open**, **macOS-native**, **stealth** real-time copilot — faster and calmer than Pluely, deeper than a chat overlay, without Cluely’s bloat or closed stack.

**Public repo:** [RajPabnani03/cluely-hidden](https://github.com/RajPabnani03/cluely-hidden)  
**Shipped:** v0.5.0 — Gemini Live, mic, capture, streaming UX, profiles, SQLite history (partial wiring).

---

## What we learn from Pluely ([site](https://pluely.com/) · [GitHub](https://github.com/iamsrikanthnani/pluely))

| Pluely strength | Our take |
|-----------------|----------|
| ~10MB Tauri, translucent always-on-top | **Match** — same stack; keep bundle lean |
| `content_protected` invisibility | **Done** — non-negotiable P0 |
| Custom AI via cURL templates (any provider) | **Adopt (v0.7)** — “Dev Space” provider packs; default stays Gemini Live |
| System audio + VAD + STT providers | **Adopt (v0.6–0.7)** — ScreenCaptureKit loopback + optional Whisper |
| Screenshot manual mode, multi-attach | **Extend** — ⌘+Enter pipeline + attachment tray in overlay |
| Global shortcuts (toggle, dashboard, audio, voice, screenshot) | **Beat** — 11 cheating-daddy actions + rebind UI |
| Adjustable transparency, drag anywhere | **Adopt (v0.6)** — slider + position persistence |
| Separate dashboard window | **Simplify** — single shell, 7 views (already have); optional compact “pill” overlay |
| Cross-platform Win/Linux | **Defer** — macOS excellence first (Pluely’s moat is breadth; ours is depth + Live) |
| GPL + optional hosted API | **Differentiate** — MIT/Apache-style OSS, **BYOK only**, no vendor API lock-in |

**Pluely gaps we exploit**

- No **native Gemini Live** bidi audio (they’re HTTP/STT-heavy).
- No **6 interview/meeting profiles** with one-tap “Use for live” (we started this).
- No **response carousel** (⌘+[/]) for multiple AI drafts in one beat.
- No **2-stage model** (listen on Live → flash answer on screenshot) from cheating-daddy.
- Weak **local memory** story vs “chat history only.”

---

## Out-of-the-box bets (not copying — **leading**)

### 1. **Dual-brain pipeline** (cheating-daddy DNA)

- **Ear:** Gemini Live — continuous listen, partial transcripts, low latency.
- **Eyes:** Screenshot → Gemini Flash (or Groq) — “what should I say *right now*?”
- **Mouth:** Stream only the **speakable line** in overlay (teleprompter mode), not essay dumps.

### 2. **Session timeline** (meeting brain)

One horizontal timeline per session: mic peaks, screenshots, AI responses, profile switches. Scrub to “what was on screen when they asked X?” Export markdown for your notes — **local only**.

### 3. **Stealth tiers**

| Tier | Behavior |
|------|----------|
| **Ghost** | Text-only strip, no chrome, max opacity |
| **Glass** | Pluely-like translucent card (default) |
| **Focus** | Opaque for solo work; still `content_protected` |

Hotkey cycles tiers without opening Settings.

### 4. **Panic that actually erases**

Beyond hide+quit: optional **secure wipe** of session DB slice, capture folder, and Keychain entries (user toggle). Pluely quits; we **erase evidence**.

### 5. **Keyboard-only surface**

Mouse never required: move window (Alt+arrows), scroll answers, cycle responses, trigger capture — reduces “cursor trail” bugs Pluely users report.

### 6. **Local RAG (v1.0)**

Embed past meetings + PDFs you drop in a vault folder. “What did we agree with Acme last Tuesday?” — **no cloud index**.

### 7. **Calendar-aware profiles** (macOS)

Read next calendar event title → suggest profile (Interview / Sales / Meeting). Opt-in, EventKit, no Google scrape.

### 8. **Confidence & brevity controls**

Profile knobs: *max words*, *assertiveness*, *ask clarifying question yes/no* — tuned for interviews vs exams.

---

## Competitive position (one line)

**Pluely** = universal BYOK overlay. **Cluely Hidden** = **real-time ear + eyes + teleprompter** for high-stakes conversations, macOS-native, open, privacy-first.

---

## Architecture pillars (locked)

1. **Stealth** — Dock-less, share-invisible, Accessory policy.
2. **Live first** — WebSocket audio path is the hero; HTTP is fallback.
3. **Local data** — SQLite + files; secrets in Keychain.
4. **Craft org** — Rust / Frontend / UX / QA / Research lanes (see `cluely-director` skill).

---

## Release trains

| Version | Theme | Exit criteria |
|---------|--------|----------------|
| **v0.5.x** | Polish unsigned ship | DMG on GitHub release, E2E checklist green |
| **v0.6** | **Trust + loopback** | Keychain keys, settings persist, live→history, system audio spike |
| **v0.7** | **Overlay 2.0** | Transparency, pill UI, screenshot tray, 11 hotkeys complete |
| **v0.8** | **Dual-brain** | Screenshot→Flash answer while Live session active |
| **v0.9** | **Timeline + export** | Session scrubber, markdown export |
| **v1.0** | **Exceptional** | Local RAG vault, calendar hints, signed/notarized default, Cluely.com UX parity review signed off |

Detail: [`ROADMAP.md`](./ROADMAP.md).

---

## What we will NOT build (pre-1.0)

- Hosted LLM API / subscriptions (BYOK only).
- Windows/Linux ports until macOS 1.0 bar met.
- Growth/marketing automation (per your bar: product first).

---

## Inspiration credits

- [Pluely](https://github.com/iamsrikanthnani/pluely) — Tauri stealth, provider flexibility, overlay UX.
- [cheating-daddy](https://github.com/sohzm/cheating-daddy) — Gemini Live, hotkeys, profiles, emergency erase, 2-model flow.
- [cluely.com](https://cluely.com/) — positioning reference (we exceed on open + lean + Live).