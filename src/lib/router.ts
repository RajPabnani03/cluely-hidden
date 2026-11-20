/**
 * View-state router for the single-window overlay.
 *
 * Phase 3D pivot: we now model the UI after the official Cluely UX —
 * a single floating assistant card as the primary view, with secondary
 * views (settings, history, help) rendered as overlays / sheets.
 */

import { create } from "zustand";

type ViewId =
  | "assistant"
  | "settings"
  | "history"
  | "help";

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
