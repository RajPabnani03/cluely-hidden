# Sprint C — Dual brain & live UX

Sprint C is the **in-call coaching loop**: live Gemini session + fast “what to say” flashes from screen context.

## How to use

1. **Start session** — overlay → **Start session** (or **⌘+Enter** when idle).
2. **Mic** — enable mic; pick **VAD** in Settings → General:
   - **Balanced** — sends audio when you’re speaking (default).
   - **Aggressive** — higher threshold, less background noise.
   - **Manual** — hold the mic button while talking (push-to-talk).
3. **Screenshots** — **Take screenshot** or rely on **⌘+Enter** (dual-brain captures fresh screen).
4. **Dual brain** — during an active session, **⌘+Enter** runs `dual_brain_step`:
   - Uses live transcript + screenshot tray notes + active profile (`max_words`, `tone`).
   - Shows answer in the **teleprompter** strip and chat.
5. **Carousel** — each dual-brain / completed live reply is snapshotted. **⌘+[** / **⌘+]** cycles; teleprompter and chat stay in sync.

## Profiles (Settings → Profiles)

| Field | Effect |
|-------|--------|
| **System prompt** | Live session + dual-brain instructions |
| **Max words** | Caps speakable length (default 120) |
| **Tone** | e.g. confident, warm — injected into dual-brain prompt |

## IPC / events (for debugging)

| Name | Role |
|------|------|
| `dual_brain_step` | Capture + Gemini flash → `{ speakable, capture }` |
| `ai:speakable` | Event with teleprompter text |
| `set_mic_gate` | Manual VAD open/closed |

## Verify locally

```bash
cd ~/Code/cluely-hidden && npm run typecheck
cd src-tauri && cargo check
npm run tauri dev
```

Checklist:

- [ ] Live session connects (Gemini key in Settings).
- [ ] ⌘+Enter with session → teleprompter updates.
- [ ] Tray shows captures after dual-brain.
- [ ] ⌘+]/⌘+[ cycles responses + teleprompter.
- [ ] Profile max words / tone change dual-brain output style.
- [ ] Manual VAD only sends audio while mic button held.

## Known gaps (v0.6)

- Dual-brain is **text-only** on capture metadata (not full vision on PNG yet).
- Carousel does not yet persist separate variants in DB (only latest assistant lines via `saveMessage` per step).