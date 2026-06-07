/**
 * Re-export of AssistantView. Kept so any external code (devtools, tests)
 * that still imports `routes/Overlay` keeps working.
 *
 * The original Overlay.tsx (chrome titlebar + ChatStream + InputBar) is
 * now part of `AssistantView.tsx` inside the new single-window view
 * architecture introduced in Phase 3C.
 */

export { AssistantView as Overlay } from "./views/AssistantView";
