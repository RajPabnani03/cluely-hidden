# Release v0.5.0 — Live & Invisible (signed .dmg)

**Target:** Shippable macOS app with Gemini Live, stealth overlay, signed + notarized `.dmg`.  
**Codename:** Live & Invisible  
**Program owner:** Director + QA/Release Lead

---

## Release thesis

Stealth overlay that **listens (mic), sees (screenshot), and streams answers** in a Cluely-shaped card — with local history and macOS screen-share invisibility.

---

## Milestones

| Milestone | Goal | Exit criteria |
|-----------|------|----------------|
| **M1** | Shippable core | Real API key + profile → Live; E2E checklist green |
| **M2** | Exceptional UX | Top 2 parity gaps + persist live turn to SQLite (optional) |
| **M3** | Release train | CHANGELOG, README, version bump, `tauri build` |
| **M4** | Signed + notarized | Valid codesign identity + Apple notary; Gatekeeper clean install |

---

## M1 — Shippable core (in progress)

- [x] `gemini_api_key` + `active_profile_id` in settings (Rust + Settings UI)
- [x] `ai_start_live_configured` uses stored key + profile `system_prompt`
- [x] Empty key → clear error directing user to Settings
- [ ] Manual E2E (see bottom) run on dev build

---

## M2 — Exceptional UX (pick 2+)

- [ ] Cluely.com parity audit → ship top 2 gaps
- [ ] Save live assistant text to DB on `ai:turn:complete`
- [ ] HelpView: 11 hotkeys list (read-only)

---

## M3 — Release train

- [x] `CHANGELOG.md`
- [x] `README.md` (v0.5, Gemini Live, settings)
- [x] Version `0.5.0` in `package.json`, `Cargo.toml`, `tauri.conf.json`
- [ ] `npm run tauri:build` on your machine (unsigned)
- [x] Git tag `v0.5.0`

---

## M4 — Code signing & notarization (Option C)

**Deferred** — shipping **v0.5.0 unsigned** per product decision. Scaffold remains (`entitlements.plist`, `scripts/signing.env.example`). Re-enable when Developer ID cert is on the build Mac.

```bash
security find-identity -v -p codesigning
```

**Required:** at least one **Developer ID Application** identity (not “0 valid identities”).

### One-time setup (you)

1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/) ($99/yr).
2. Xcode → Settings → Accounts → Manage Certificates → **Developer ID Application**.
3. Or: `xcodebuild -runFirstLaunch` then create cert in Keychain.
4. Notary credentials (choose one):
   - **App-specific password:** `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
   - **API key:** `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_PATH` (Tauri 2 docs)

Store secrets in **Keychain / env**, never in git. Add to `~/.zshrc` or use `export` in a local `scripts/signing.env` (gitignored).

### `tauri.conf.json` (when identity exists)

```json
"macOS": {
  "minimumSystemVersion": "12.0",
  "signingIdentity": "Developer ID Application: Your Name (TEAMID)",
  "entitlements": "entitlements.plist",
  "hardenedRuntime": true
}
```

### Build signed release

```bash
cd ~/Code/cluely-hidden
source scripts/signing.env   # your local file, not committed
npm run typecheck && npm run build
npm run tauri:build
```

### Verify

```bash
spctl --assess --verbose=4 "src-tauri/target/release/bundle/macos/Cluely Hidden.app"
codesign -dv --verbose=4 "…/Cluely Hidden.app"
```

Expect **accepted** + notarized staple on `.dmg` when Tauri notary hooks are configured.

### Blocker today

On this Mac: **0 valid codesigning identities** and Apple env vars **unset**. M4 cannot complete until you add the Developer ID cert.

---

## Manual E2E (run before tag)

1. [ ] Overlay toggle (⌘\\)
2. [ ] Settings → Gemini API key saved
3. [ ] Profile selected → Start session → **ready**
4. [ ] Mic → VU meter → stop
5. [ ] Screenshot → preview
6. [ ] Streamed text in ChatStream (dots → caret → complete)
7. [ ] History search/delete
8. [ ] Emergency erase (if default binding)
9. [ ] Stealth in screen-share
10. [ ] Fresh `.dmg` install (M4)

---

## Deferred → v0.6

- System/meeting loopback audio
- Ollama / Groq providers
- Hotkey rebinding UI
- App Store listing

---

## Commit map (since v0.3.0 narrative)

| Commit | Theme |
|--------|--------|
| `806b31a` | Gemini Live + capture |
| `730fe8f` | History |
| `4f3ac34` | Chrome polish |
| `7cec90b` | Assistant IPC |
| `99b651b` | Mic UI |
| `803dfed` | Mic Rust pipeline |
| `dd6223b` | Streaming UX |