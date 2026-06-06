import { useState } from "react";
import { Send, Mic, Camera } from "lucide-react";
import { useOverlayStore } from "../lib/store";
import { chat, type ChatMessage } from "../lib/tauri";
import { cn } from "../lib/utils";

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function InputBar() {
  const [value, setValue] = useState("");
  const streaming = useOverlayStore((s) => s.streaming);
  const setStreaming = useOverlayStore((s) => s.setStreaming);
  const conversationId = useOverlayStore((s) => s.currentConversationId);
  const setConversationId = useOverlayStore((s) => s.setConversationId);
  const appendMessage = useOverlayStore((s) => s.appendMessage);
  const updateLastMessage = useOverlayStore((s) => s.updateLastMessage);

  const send = async () => {
    const trimmed = value.trim();
    if (!trimmed || streaming) return;
    setValue("");

    // Optimistic user message
    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    appendMessage(userMsg);

    // Stub assistant message (will be replaced by streamed chunks in Phase 7)
    const assistantMsg: ChatMessage = {
      id: genId(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };
    appendMessage(assistantMsg);
    setStreaming(true);

    try {
      const reply = await chat({
        conversationId,
        message: trimmed,
      });
      // Persist the new conversation id for next turn
      if (reply.id && !conversationId) {
        // Server may return a conversation id on the first message
        setConversationId(reply.id);
      }
      updateLastMessage(reply.content);
    } catch (err) {
      console.error(err);
      updateLastMessage(`[error] ${String(err)}`);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 relative">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask anything…"
          rows={1}
          className={cn(
            "w-full resize-none",
            "bg-muted/50 border border-white/5 rounded-xl",
            "px-3.5 py-2.5 pr-9 text-sm",
            "placeholder:text-muted-foreground/50",
            "focus:outline-none focus:ring-1 focus:ring-primary/50",
            "max-h-32 scrollbar-thin",
          )}
        />
      </div>
      <button
        className="tauri-no-drag p-2.5 rounded-xl text-muted-foreground hover:bg-white/5 transition-colors"
        title="Voice input (Phase 4)"
        disabled
      >
        <Mic className="w-4 h-4" />
      </button>
      <button
        className="tauri-no-drag p-2.5 rounded-xl text-muted-foreground hover:bg-white/5 transition-colors"
        title="Screen capture (Phase 4)"
        disabled
      >
        <Camera className="w-4 h-4" />
      </button>
      <button
        onClick={send}
        disabled={!value.trim() || streaming}
        className={cn(
          "tauri-no-drag p-2.5 rounded-xl transition-colors",
          value.trim() && !streaming
            ? "bg-primary text-primary-foreground hover:opacity-90"
            : "bg-muted text-muted-foreground/50 cursor-not-allowed",
        )}
        title="Send (Enter)"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
