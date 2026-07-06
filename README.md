# Cluely Hidden

> Stealth AI assistant overlay for macOS — Gemini Live, local history, invisible in screen-share.

Press **⌘+Shift+Space** to show/hide the overlay (tray + global hotkeys). See **Help** in-app for all 11 shortcuts.

![status](https://img.shields.io/badge/release-v0.5.0-blue) ![stack](https://img.shields.io/badge/stack-Tauri%202%20%2B%20React%20%2B%20TS-orange) ![license](https://img.shields.io/badge/license-MIT-green)

---

## What it does (v0.5.0)

- **Stealth overlay** — transparent, always-on-top, optional click-through; hidden from Dock / screen-share
- **Gemini Live** — voice + text session with mic capture and screen screenshots
- **6 profiles** — Interview, Sales, Exam, etc.; pick **Use for live** in Settings
- **Local SQLite** — conversation history with search
- **Cluely-shaped UI** — streaming responses, VU meter, recording pill, quick actions

See [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`PLAN.md`](./PLAN.md), and [`RELEASE-v0.5.0.md`](./RELEASE-v0.5.0.md).

---

## Quick start

```bash
npm install
npm run tauri:dev
```

1. Open **Settings → Model** and paste your [Gemini API key](https://aistudio.google.com/).
2. **Settings → Profiles** → **Use for live** on a profile.
3. **Start session** on the Assistant card, then mic / screenshot as needed.

### Release build (unsigned)

```bash
npm run typecheck && npm run build
npm run tauri:build
# DMG: src-tauri/target/release/bundle/dmg/
```

macOS may warn on first open (not notarized). **Right-click → Open** or allow in Privacy & Security.

### Prerequisites

- macOS 12+
- Rust 1.77+, Node 18+, Xcode CLT

---

## Development

```bash
npm run tauri:dev    # hot reload
npm run typecheck
npm run tauri:build  # .app + .dmg
cd src-tauri && cargo check
```

---

## Roadmap

| Version | Status | Highlights |
|---------|--------|------------|
| **v0.5.0** | ✅ Current | Gemini Live, mic, history, settings key, streaming UX |
| v0.6 | Planned | Persist settings/keychain, meeting audio, Ollama |
| v1.0 | Planned | Signed + notarized `.dmg` |

See [`CHANGELOG.md`](./CHANGELOG.md).

**Security:** API keys and signing credentials stay on your machine only — see [`SECURITY.md`](./SECURITY.md).

---

## License

MIT

## Inspiration

[Cluely](https://cluely.com) · [Hermes Agent](https://hermes-agent.nousresearch.com)