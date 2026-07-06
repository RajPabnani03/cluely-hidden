# E2E checklist — Sprint A (v0.6 foundation)

Manual verification on macOS after `npm run tauri:dev`.

## A1 Keychain

1. Open **Settings → Model**, paste a Gemini API key, blur the field.
2. Quit the app fully (tray → Quit).
3. Relaunch — **Start Live** should connect without re-entering the key.
4. Confirm `~/Library/Application Support/com.cluelyhidden.app/settings.json` has **no** `geminiApiKey` field.

## A2 Persisted settings

1. Change **theme**, **active profile**, **model**, **Google Search** toggle.
2. Relaunch — choices should match.

## A3 Live → History

1. Start Live, speak or wait for assistant text, **Stop**.
2. Open **History** — new conversation with transcript / assistant lines.

## A5 Overlay opacity

1. **Settings → General → Panel opacity** — drag slider, release.
2. Assistant card glass should update; relaunch keeps value.

## Security

- `get_settings` in DevTools / IPC must not return raw `geminiApiKey` (only `geminiApiKeyConfigured`).