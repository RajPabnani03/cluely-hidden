# UI/UX overhaul — Cluely parity

**Goal:** One floating card that feels like [cluely.com](https://cluely.com): undetectable overlay, focal **AI response**, marketing-style **mode chips**, screen context above the answer, minimal chrome.

## Information architecture (overlay)

| Zone | Cluely reference | Our implementation |
|------|------------------|-------------------|
| Header | Logo + Recording + Hide | `CluelyLogo`, `RecordingPill`, Undetectable pill, ⋯ menu |
| Modes | Assist / Say / Follow-up / Recap | `QuickActionChips` (segmented pill) |
| Context | “Viewed your screen” + thumbnail | `ScreenshotPreview` (above response) |
| Hero | Large speakable line | `TeleprompterStrip` (“AI response”) |
| Thread | Secondary chat | `ChatStream` (dedupes hero line) |
| Live | Start listening, Screen, Mic | `SessionToolbar` (not “Gemini Live” panel) |
| Input | Smart + ask + ⌘↵ | `InputBar` |
| Hints | Keycaps | `HotkeyHintBar` |

## Design tokens (`globals.css`)

- Surface: `--cluely-surface`, `--cluely-surface-elevated`
- Radius: 20px card, 2xl inner blocks
- Type: 17px hero, 13–14px body, 10–11px chrome
- Motion: `animate-fade-in`, reduced-motion safe

## What we removed (noise)

- Crowded header (VU meter, duplicate status pills, Stop in chrome)
- Duplicate mode label under chips
- Large “Gemini Live” dev console block
- Emerald teleprompter (now neutral hero like marketing card)

## Next UX passes (your feedback)

1. **Settings / History sheets** — same segmented tabs + section cards as overlay
2. **Onboarding** — first-run API key + permissions (Cluely “Get desktop app” moment)
3. **Light theme** — token swap when `theme: light`
4. **Motion** — subtle chip/response transitions (respect reduced motion)
5. **Screenshot tray** — icon strip only until hover

## Verify

```bash
cd ~/Code/cluely-hidden && npm run tauri dev
```

1. Idle card: modes on top, calm empty state, **Start listening** CTA.
2. Live: **Recording** pill, screen preview above response, **⌘↵** teleprompter.
3. Hide / ⋯ / Settings still reachable without clutter.