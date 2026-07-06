# Spike: system audio (meeting loopback)

**Goal (Sprint A4):** Feed **other participants’ audio** into Gemini Live alongside the mic — Pluely-style “hear the call.”

## macOS options

| Approach | Notes |
|----------|--------|
| **ScreenCaptureKit** (audio) | Tauri 2 / Rust crate or `cidre` — needs screen-recording permission |
| **BlackHole + aggregate device** | User-installed virtual device; we read mixed input via `cpal` |
| **Core Audio tap** | Lower-level; higher maintenance |

## Recommendation

1. **v0.6.1:** Document BlackHole setup + `audio_enabled` routes mic-only (current).
2. **v0.7:** ScreenCaptureKit audio stream → resample 16 kHz → `ai_send_audio` with a `source: system` tag in protocol.

## Status

`audio_enabled` in settings is persisted; pipeline still **mic-only**. No system tap wired yet.