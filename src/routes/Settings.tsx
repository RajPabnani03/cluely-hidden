/**
 * Re-export of AICustomizeView. Kept so `src/settings.tsx` (the separate
 * settings window entry point) still resolves its `Settings` import.
 *
 * The original Settings.tsx (theme/model/capture/system sections) has
 * been split into `CustomizeView.tsx` (appearance) and `AICustomizeView.tsx`
 * (AI behavior + profiles) inside the new single-window view architecture
 * introduced in Phase 3C.
 */

export { AICustomizeView as Settings } from "./views/AICustomizeView";
