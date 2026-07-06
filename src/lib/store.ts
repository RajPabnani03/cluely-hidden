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

  setVisible: (v: boolean) => void;
  toggleVisible: () => void;
  setClickThrough: (enabled: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setConversationId: (id: string | null) => void;
  setConversationTitle: (title: string) => Promise<void>;
  appendMessage: (msg: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
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

  setVisible: (v) => set({ visible: v }),
  toggleVisible: () => set((s) => ({ visible: !s.visible })),
  setClickThrough: (enabled) => set({ clickThrough: enabled }),
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
