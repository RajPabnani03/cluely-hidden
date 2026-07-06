# Security

**Cluely Hidden** is a **public** repository. User API keys and signing credentials must **never** appear in git, issues, screenshots, or release artifacts.

## What stays local only

| Secret | Where it belongs |
|--------|------------------|
| **Gemini API key** | Your machine only (today: in-app settings in memory; **v0.6+**: Keychain / encrypted store under `~/Library/Application Support/com.cluelyhidden.app/`) |
| **Apple signing** | `scripts/signing.env` (gitignored) or Keychain — never commit |
| **`.env` / `.env.local`** | Gitignored |

## Do not commit

- Real `AIza…` keys, `sk-…`, GitHub tokens, app-specific passwords
- `scripts/signing.env`, `.pem`, `.p12`, provisioning profiles
- Screen captures or DB dumps that contain conversation PII you care about

## If a key was exposed

1. **Revoke immediately** in [Google AI Studio](https://aistudio.google.com/) (or the relevant provider).
2. Create a **new** key; update only in local Settings.
3. If it was pushed to GitHub: rotate the key **before** relying on history rewrite; consider `git filter-repo` only if you understand the blast radius.

## Reporting vulnerabilities

Open a **private** security advisory on GitHub (Security → Advisories → Report) or contact the maintainer directly. Do not post live keys in public issues.

## Maintainer checklist (before every push)

```bash
# Quick scan — should return only placeholders/docs, not real keys
rg -i 'AIza[0-9A-Za-z_-]{20,}|sk-[a-zA-Z0-9]{20,}' --glob '!node_modules' .
```

## Roadmap (hardening)

- [ ] Persist Gemini key in **macOS Keychain**, not plaintext JSON
- [ ] `get_settings` returns `geminiApiKeyConfigured: boolean` instead of the raw key
- [ ] Redact query strings in WebSocket error logs
- [ ] Optional: GitHub Actions secret scanning on PRs

See also [`CHANGELOG.md`](./CHANGELOG.md) upgrade notes.