# Cluely Hidden

> A lightweight, stealth AI assistant overlay for macOS. Local-first. Grows on your data.

Press **⌘+Shift+Space** to summon. Press again to dismiss. That's the whole UX.

![status](https://img.shields.io/badge/status-v0.1.0--scaffold-blue) ![stack](https://img.shields.io/badge/stack-Tauri%202%20%2B%20React%20%2B%20TS-orange) ![license](https://img.shields.io/badge/license-MIT-green)

---

## What it does

- **Stealth overlay** — always-available, transparent, always-on-top, click-through toggle
- **Global hotkey** — `⌘+Shift+Space` to show/hide from anywhere
- **Tray icon** — right-click menu for quick access
- **Local-first AI** — v0.2: routes to Ollama running on your machine; v0.3: cloud optional
- **Grows on your data** — extracts facts from your conversations, builds a local memory graph
- **Screen + audio capture** — opt-in, all stored locally

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design and [`PLAN.md`](./PLAN.md) for the implementation roadmap.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Run in dev mode (opens the dev window + builds Rust)
npm run tauri:dev

# 3. Build a release .dmg
npm run tauri:build
# Output: src-tauri/target/release/bundle/dmg/Cluely Hidden_0.1.0_aarch64.dmg
```

### Prerequisites

- macOS 12+ (Apple Silicon or Intel)
- **Rust** (1.77+): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Node.js** (18+): `brew install node` or use nvm
- **Xcode Command Line Tools**: `xcode-select --install`

---

## Project layout

```
cluely-hidden/
├── ARCHITECTURE.md          # Full system design
├── PLAN.md                  # Bite-sized implementation plan
├── TEAM.md                  # Subagent team definitions
├── RUN.md                   # Exact commands to bootstrap
├── package.json             # Node deps + scripts
├── vite.config.ts           # Vite + Tauri config
├── tsconfig.json            # TypeScript strict mode
├── tailwind.config.js       # Tailwind + shadcn theme tokens
├── index.html               # Vite entry
├── src/                     # React + TypeScript frontend
│   ├── main.tsx
│   ├── App.tsx              # Router / window shell
│   ├── routes/
│   │   └── Overlay.tsx      # The stealth overlay UI
│   ├── components/
│   │   ├── ChatStream.tsx
│   │   ├── InputBar.tsx
│   │   └── DevPanel.tsx
│   ├── lib/
│   │   ├── tauri.ts         # Typed IPC wrappers
│   │   ├── store.ts         # Zustand state
│   │   └── utils.ts         # cn() helper, formatters
│   └── styles/
│       └── globals.css      # Tailwind + custom
└── src-tauri/               # Rust + Tauri core
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── build.rs
    ├── capabilities/
    │   └── default.json
    ├── icons/               # App + tray icons
    └── src/
        ├── main.rs          # Entry
        ├── lib.rs           # Plugin wiring + setup
        ├── config.rs        # Constants
        ├── error.rs         # AppError + Result alias
        ├── settings.rs      # AppSettings + state
        ├── window/
        │   ├── mod.rs
        │   ├── overlay.rs   # Stealth overlay creation
        │   ├── tray.rs      # NSStatusItem tray
        │   └── helpers.rs   # show/hide/toggle/click-through
        └── ipc/
            ├── mod.rs
            └── commands.rs  # #[tauri::command] handlers
```

---

## Development

```bash
# Hot-reload dev (Tauri dev server with Vite HMR)
npm run tauri:dev

# Type-check TypeScript
npm run typecheck

# Lint
npm run lint

# Unit tests (Vitest)
npm test

# Production build (.app + .dmg)
npm run tauri:build
```

### Rust-only commands

```bash
cd src-tauri
cargo check           # fast type check
cargo clippy          # lints
cargo test            # unit tests
cargo build --release # release binary
```

---

## Roadmap

| Version | Status | What's in |
|---|---|---|
| **v0.1.0** | 🏗️ Building | Overlay + hotkey + tray + stub chat |
| v0.2.0 | 📋 Planned | Ollama integration, real streaming chat |
| v0.3.0 | 📋 Planned | Screen + audio capture, fact extraction |
| v0.4.0 | 📋 Planned | Vector memory, "grows on your data" loop |
| v0.5.0 | 📋 Planned | Cloud provider support, custom skills |
| v1.0.0 | 📋 Planned | Code-signed, notarized, polished `.dmg` |

See [`PLAN.md`](./PLAN.md) for the full task breakdown.

---

## License

MIT

---

## Inspiration

- [Cluely](https://cluely.com) — the original stealth interview assistant
- [Pluely](https://www.pluely.com) — lightweight overlay UI
- [Hermes Agent](https://hermes-agent.nousresearch.com) — local-first AI agent with skills/memory
