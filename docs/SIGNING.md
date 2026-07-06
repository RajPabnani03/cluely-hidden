# macOS release & signing

Cluely Hidden ships **unsigned** DMGs by default. Signed/notarized builds need a **Developer ID Application** cert on the build Mac.

## Local signed build

1. Copy `scripts/signing.env.example` → `scripts/signing.env` (gitignored).
2. Set `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_APP_PASSWORD` (app-specific).
3. Run:

```bash
./scripts/build-dmg.sh
```

See `scripts/signing.env.example` for variable names.

## CI (GitHub Actions)

Workflow `.github/workflows/macos-release.yml` runs `cargo tauri build` on `macos-latest`.  
**Signing in CI** requires importing cert + notary credentials as encrypted repo secrets — not enabled by default in the skeleton.

## Artifacts

- `src-tauri/target/release/bundle/dmg/*.dmg`
- Upload to GitHub Releases manually or via workflow `workflow_dispatch`.

## Security

Never commit `signing.env`, `.p12`, or notary passwords. See root `SECURITY.md`.