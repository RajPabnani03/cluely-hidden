import { useEffect, useRef, useState } from "react";
import { Mic, ArrowUp } from "lucide-react";
import { useOverlayStore } from "../lib/store";
import { SmartToggle } from "./SmartToggle";
import { type QuickAction } from "./QuickActionChips";
import { chat, type ChatMessage } from "../lib/tauri";
import { cn } from "../lib/utils";

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface InputBarProps {
  mode: QuickAction;
}

const MODE_PLACEHOLDERS: Record<QuickAction, string> = {
  assist: "Ask about your screen or conversation…",
  say: "What scenario do you need words for?",
  followup: "Who are you talking to?",
  recap: "Recap the last few minutes…",
};

/**
 * InputBar — Smart toggle + auto-resizing textarea + mic/send action.
 */
export function InputBar({ mode }: InputBarProps) {
  const [value, setValue] = useState("");
  const [smart, setSmart] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const streaming = useOverlayStore((s) => s.streaming);
  const setStreaming = useOverlayStore((s) => s.setStreaming);
  const conversationId = useOverlayStore((s) => s.currentConversationId);
  const setConversationId = useOverlayStore((s) => s.setConversationId);
  const appendMessage = useOverlayStore((s) => s.appendMessage);
  const updateLastMessage = useOverlayStore((s) => s.updateLastMessage);

  // Auto-resize textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [value]);

  const send = async () => {
    const trimmed = value.trim();
    if (!trimmed || streaming) return;
    setValue("");

    const prefix =
      mode === "say"
        ? "[What should I say?] "
        : mode === "followup"
          ? "[Follow-up question] "
          : mode === "recap"
            ? "[Recap] "
            : "";

    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: prefix + trimmed,
      createdAt: Date.now(),
    };
    appendMessage(userMsg);

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
        message: prefix + trimmed,
      });
      if (reply.id && !conversationId) {
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
    <div
      className={cn(
        "flex items-end gap-2 rounded-xl border border-zinc-700/60 bg-zinc-800 px-2 py-2",
        "focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600/50",
      )}
    >
      <div className="py-1.5 pl-1">
        <SmartToggle checked={smart} onChange={setSmart} />
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={MODE_PLACEHOLDERS[mode]}
        rows={1}
        className={cn(
          "flex-1 min-w-0 bg-transparent text-[13px] text-zinc-100 placeholder:text-zinc-500",
          "resize-none outline-none py-1.5 max-h-24 scrollbar-thin",
        )}
      />

      <button
        onClick={send}
        disabled={!value.trim() || streaming}
        className={cn(
          "shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
          value.trim() && !streaming
            ? "bg-zinc-100 text-zinc-900 hover:bg-white"
            : "bg-zinc-700 text-zinc-500 cursor-not-allowed",
        )}
        title={value.trim() ? "Send" : "Mic (not yet wired)"}
      >
        {value.trim() ? (
          <ArrowUp className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
