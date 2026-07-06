# Cluely.com parity audit (cluely-hidden)

**Date:** 2026-03-29  
**Reference:** [cluely.com](https://cluely.com) marketing UX (not source code).

## Core loop

| Cluely promise | cluely-hidden | Gap |
|----------------|---------------|-----|
| Invisible overlay during calls | macOS stealth tiers + click-through | Windows/Linux N/A |
| Real-time “what to say” | Dual-brain + teleprompter + Live transcript | Needs multimodal screen in prompt |
| One-key advance | ⌘+Enter `next_step` → dual brain | Parity ✓ |
| Screenshot context | Tray + capture in dual-brain | Parity ✓ |

## Profiles & modes

| Feature | Status |
|---------|--------|
| Interview / sales / meeting presets | 6 builtins + custom profiles |
| Tone + length controls | `tone`, `max_words` per profile |
| Assist / say / follow-up / recap chips | UI chips; recap = partial |

## History & trust

| Feature | Status |
|---------|--------|
| Session list + search | Client-side search |
| Timeline | Per-session message timeline |
| Export | Markdown to clipboard |
| Panic erase | Hotkey + Settings wipe |

## Integrations (Cluely advertises broader stack)

| Integration | cluely-hidden |
|-------------|---------------|
| Calendar-aware hints | AppleScript stub (macOS Calendar permission) |
| Local knowledge base | Vault folder index stub |
| CRM / Slack / etc. | Not planned v0.6 |

## Release

| Item | Status |
|------|--------|
| Signed DMG | Documented; requires `scripts/signing.env` |
| CI build | `.github/workflows/macos-release.yml` skeleton |

## Priority gaps for “exceptional” bar

1. **Multimodal dual-brain** — send latest capture image to Gemini, not text-only flash.
2. **Audio loopback** — hear meeting participants, not only mic.
3. **Polish** — carousel animates content swap; teleprompter font size user preference.
4. **Onboarding** — first-run API key + permissions checklist.