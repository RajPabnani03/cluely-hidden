import { create } from "zustand";
import {
  type ChatMessage,
  type HotkeyBindings,
  type HotkeyActionId,
  getHotkeyBindings,
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
  appendMessage: (msg: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
  clearMessages: () => void;
  setHotkeyBindings: (b: HotkeyBindings) => void;
  loadHotkeyBindings: () => Promise<void>;
  resetSensitiveState: () => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
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
