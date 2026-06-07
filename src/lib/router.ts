/**
 * View-state router for the single-window, multi-view overlay.
 *
 * This is a tiny zustand-backed state machine — no URL, no router library.
 * The "view" is a string; components subscribe to `useRouter()` and re-render
 * when it changes. Keeps the mental model simple and the bundle small.
 *
 * 7 views total:
 *   - assistant    — the live AI assistant (default after onboarding)
 *   - main         — landing / profile picker
 *   - onboarding   — 4-step first-run wizard
 *   - customize    — appearance (theme, font size, transparency)
 *   - ai-customize — AI behavior + profile editor
 *   - history      — past conversations
 *   - help         — hotkeys + FAQ
 *
 * Phase 3C: pure UI plumbing, no persistence yet (localStorage in a later phase).
 */

import { create } from "zustand";

export type ViewId =
  | "assistant"
  | "main"
  | "onboarding"
  | "customize"
  | "ai-customize"
  | "history"
  | "help";

/** Human-readable label for the top of the Sidebar tooltip / a11y. */
export const VIEW_LABELS: Record<ViewId, string> = {
  assistant: "Assistant",
  main: "Home",
  onboarding: "Welcome",
  customize: "Customize",
  "ai-customize": "AI Customize",
  history: "History",
  help: "Help",
};

interface RouterState {
  currentView: ViewId;
  hasOnboarded: boolean;
  setView: (v: ViewId) => void;
  setOnboarded: () => void;
  resetOnboarding: () => void;
}

export const useRouter = create<RouterState>((set) => ({
  currentView: "main",
  hasOnboarded: false,
  setView: (v) => set({ currentView: v }),
  setOnboarded: () => set({ hasOnboarded: true }),
  resetOnboarding: () => set({ hasOnboarded: false, currentView: "onboarding" }),
}));

/** Convenience: list of all views in sidebar order. */
export const ALL_VIEWS: ViewId[] = [
  "assistant",
  "main",
  "onboarding",
  "customize",
  "ai-customize",
  "history",
  "help",
];
