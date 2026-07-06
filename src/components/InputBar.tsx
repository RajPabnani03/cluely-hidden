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
  assist: "Ask a question, or about your screen or conversation…",
  say: "What should I say in this moment?",
  followup: "Ask a follow-up question…",
  recap: "Recap the last few minutes…",
};

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
    <div className="space-y-1.5">
      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-zinc-950/60 px-2.5 py-2",
          "focus-within:border-white/[0.12] focus-within:ring-1 focus-within:ring-white/10",
        )}
      >
        <div className="py-1.5 pl-0.5 shrink-0">
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
          type="button"
          onClick={send}
          disabled={!value.trim() || streaming}
          className={cn(
            "shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all",
            value.trim() && !streaming
              ? "bg-zinc-100 text-zinc-900 hover:bg-white shadow-sm"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed",
          )}
          aria-label={value.trim() ? "Send message" : "Voice input"}
        >
          {value.trim() ? (
            <ArrowUp className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>
      </div>
      <p className="text-[10px] text-zinc-600 text-center">
        Smart mode · <span className="text-zinc-500">⌘↵ Assist</span> when live
      </p>
    </div>
  );
}