import { create } from "zustand";
import {
  type ChatMessage,
  type DbConversation,
  type DbMessage,
  type HotkeyBindings,
  type HotkeyActionId,
  deleteConversation,
  getHotkeyBindings,
  listConversations,
  listMessages,
  searchConversations,
  updateConversationTitle,
} from "./tauri";

interface OverlayState {
  visible: boolean;
  clickThrough: boolean;
  streaming: boolean;
  currentConversationId: string | null;
  messages: ChatMessage[];
  hotkeyBindings: HotkeyBindings;
  overlayLayout: "full" | "compact";
  stealthTier: string;
  overlayOpacity: number;
  screenshotTray: import("./tauri").CaptureMeta[];
  responseSnapshots: string[];
  responseIndex: number;
  speakableText: string;

  setVisible: (v: boolean) => void;
  toggleVisible: () => void;
  setClickThrough: (enabled: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setConversationId: (id: string | null) => void;
  setOverlayLayout: (layout: "full" | "compact") => void;
  setStealthTier: (tier: string) => void;
  setOverlayOpacity: (o: number) => void;
  addScreenshotToTray: (meta: import("./tauri").CaptureMeta) => void;
  removeScreenshotFromTray: (id: string) => void;
  clearScreenshotTray: () => void;
  pushResponseSnapshot: (text: string) => void;
  setResponseIndex: (index: number) => void;
  setSpeakableText: (text: string) => void;
  setConversationTitle: (title: string) => Promise<void>;
  appendMessage: (msg: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
  /** Append a delta to the last assistant message (Gemini Live / streaming). */
  appendAssistantStreamChunk: (chunk: string) => void;
  clearMessages: () => void;
  setHotkeyBindings: (b: HotkeyBindings) => void;
  loadHotkeyBindings: () => Promise<void>;
  resetSensitiveState: () => void;
}

export const useOverlayStore = create<OverlayState>((set, get) => ({
  visible: false,
  clickThrough: false,
  streaming: false,
  currentConversationId: null,
  messages: [],
  hotkeyBindings: [] as HotkeyBindings,
  overlayLayout: "full" as const,
  stealthTier: "glass",
  overlayOpacity: 0.92,
  screenshotTray: [],
  responseSnapshots: [],
  responseIndex: 0,
  speakableText: "",

  setVisible: (v) => set({ visible: v }),
  toggleVisible: () => set((s) => ({ visible: !s.visible })),
  setClickThrough: (enabled) => set({ clickThrough: enabled }),
  setOverlayLayout: (layout) => set({ overlayLayout: layout }),
  setStealthTier: (tier) => set({ stealthTier: tier }),
  setOverlayOpacity: (o) => set({ overlayOpacity: o }),
  addScreenshotToTray: (meta) =>
    set((s) => {
      const next = [meta, ...s.screenshotTray.filter((x) => x.id !== meta.id)].slice(
        0,
        3,
      );
      return { screenshotTray: next };
    }),
  removeScreenshotFromTray: (id) =>
    set((s) => ({
      screenshotTray: s.screenshotTray.filter((x) => x.id !== id),
    })),
  clearScreenshotTray: () => set({ screenshotTray: [] }),
  pushResponseSnapshot: (text) =>
    set((s) => {
      const t = text.trim();
      if (!t) return s;
      const snapshots = [...s.responseSnapshots, t];
      return { responseSnapshots: snapshots, responseIndex: snapshots.length - 1 };
    }),
  setResponseIndex: (index) =>
    set((s) => {
      if (s.responseSnapshots.length === 0) return s;
      const i = Math.max(0, Math.min(index, s.responseSnapshots.length - 1));
      return { responseIndex: i };
    }),
  setSpeakableText: (text) => set({ speakableText: text }),
  setStreaming: (streaming) => set({ streaming }),
  setConversationId: (id) => set({ currentConversationId: id }),
  setConversationTitle: async (title) => {
    const { currentConversationId } = get();
    if (!currentConversationId) return;
    try {
      await updateConversationTitle(currentConversationId, title);
    } catch (err) {
      console.error("setConversationTitle failed:", err);
    }
  },
  appendMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),
  updateLastMessage: (content) =>
    set((s) => {
      if (s.messages.length === 0) return s;
      const next = [...s.messages];
      next[next.length - 1] = {
        ...next[next.length - 1],
        content,
      };
      return { messages: next };
    }),
  appendAssistantStreamChunk: (chunk) =>
    set((s) => {
      if (!chunk) return s;
      const id = () =>
        `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const next = [...s.messages];
      const last = next[next.length - 1];
      if (last?.role === "assistant") {
        next[next.length - 1] = {
          ...last,
          content: last.content + chunk,
        };
      } else {
        next.push({
          id: id(),
          role: "assistant",
          content: chunk,
          createdAt: Date.now(),
        });
      }
      return { messages: next, streaming: true };
    }),
  clearMessages: () => set({ messages: [] }),
  setHotkeyBindings: (b) => set({ hotkeyBindings: b }),
  loadHotkeyBindings: async () => {
    try {
      const b = await getHotkeyBindings();
      set({ hotkeyBindings: b });
    } catch (err) {
      console.error("loadHotkeyBindings failed:", err);
    }
  },
  resetSensitiveState: () =>
    set({
      messages: [],
      currentConversationId: null,
      streaming: false,
      clickThrough: false,
      screenshotTray: [],
      responseSnapshots: [],
      responseIndex: 0,
      speakableText: "",
    }),
}));

export type { HotkeyActionId };

// ---------- HistoryView slice (Phase 3D) ----------
//
// A thin second store that powers HistoryView's list/search/delete flow.
// Kept separate from useOverlayStore so the AssistantView is unaffected.

interface HistoryState {
  conversations: DbConversation[];
  loading: boolean;
  error: string | null;

  /** Re-fetch every conversation from SQLite. */
  loadConversations: () => Promise<void>;
  /** Filter conversations by title or message content. */
  searchConversations: (query: string) => Promise<void>;
  /** Delete a conversation and refresh the list. */
  deleteConversation: (id: string) => Promise<void>;
  /** Fetch all messages for a conversation (used when opening it). */
  getConversationMessages: (id: string) => Promise<DbMessage[]>;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  conversations: [],
  loading: false,
  error: null,

  loadConversations: async () => {
    set({ loading: true, error: null });
    try {
      const conversations = await listConversations();
      set({ conversations, loading: false });
    } catch (err) {
      console.error("loadConversations failed:", err);
      set({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  },

  searchConversations: async (query: string) => {
    set({ loading: true, error: null });
    try {
      const conversations = await searchConversations(query);
      set({ conversations, loading: false });
    } catch (err) {
      console.error("searchConversations failed:", err);
      set({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  },

  deleteConversation: async (id: string) => {
    set({ error: null });
    try {
      await deleteConversation(id);
      set((s) => ({
        conversations: s.conversations.filter((c) => c.id !== id),
      }));
    } catch (err) {
      console.error("history.deleteConversation failed:", err);
      set({
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },

  getConversationMessages: async (id: string) => {
    return listMessages(id);
  },
}));
