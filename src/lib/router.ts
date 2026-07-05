/**
 * View-state router for the single-window overlay.
 *
 * Phase 3D pivot: we now model the UI after the official Cluely UX —
 * a single floating assistant card as the primary view, with secondary
 * views (settings, history, help) rendered as overlays / sheets.
 */

import { create } from "zustand";

export type ViewId =
  | "assistant"
  | "settings"
  | "history"
  | "help";

/** Human-readable label for menus / tooltips. */
export const VIEW_LABELS: Record<ViewId, string> = {
  assistant: "Assistant",
  settings: "Settings",
  history: "History",
  help: "Help",
};

interface RouterState {
  currentView: ViewId;
  setView: (v: ViewId) => void;
  backToAssistant: () => void;
}

export const useRouter = create<RouterState>((set) => ({
  currentView: "assistant",
  setView: (v) => set({ currentView: v }),
  backToAssistant: () => set({ currentView: "assistant" }),
}));

/** Convenience: secondary overlay views. */
export const SECONDARY_VIEWS: ViewId[] = ["settings", "history", "help"];
