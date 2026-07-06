import { useEffect, useMemo, useRef } from "react";
import { useOverlayStore } from "../lib/store";
import { cn } from "../lib/utils";
import type { QuickAction } from "./QuickActionChips";
import { TypingIndicator } from "./TypingIndicator";
import { StreamingCursor } from "./StreamingCursor";

interface ChatStreamProps {
  mode: QuickAction;
}

/**
 * ChatStream — primary response area (Cluely-style consolidated text).
 */
export function ChatStream({ mode }: ChatStreamProps) {
  const messages = useOverlayStore((s) => s.messages);
  const streaming = useOverlayStore((s) => s.streaming);
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastAssistantContent = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].content;
    }
    return "";
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, lastAssistantContent.length, streaming]);

  const empty = messages.length === 0;
  const showLiveEmptyTyping = streaming && messages.length === 0;

  if (empty && !streaming) {
    const title =
      mode === "assist"
        ? "What do you want me to check?"
        : mode === "say"
          ? "What should I say?"
          : mode === "followup"
            ? "Ask about your conversation"
            : "What should I recap?";

    return (
      <div className="flex items-center justify-center min-h-[160px] text-center px-4">
        <div className="space-y-2">
          <p className="text-sm text-zinc-200 font-medium">{title}</p>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Type a message below or press{" "}
            <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[10px]">
              ⌘+Enter
            </kbd>{" "}
            to capture your screen.
          </p>
        </div>
      </div>
    );
  }

  if (showLiveEmptyTyping) {
    return (
      <div className="flex items-center min-h-[160px] px-1 py-3">
        <TypingIndicator />
      </div>
    );
  }

  return (
    <div className="px-1 py-3 space-y-4 min-h-[160px] max-h-[380px] overflow-y-auto scrollbar-thin">
      {messages.map((m, index) => {
        const isUser = m.role === "user";
        const isLast = index === messages.length - 1;
        const isStreamingAssistant =
          !isUser && isLast && streaming && m.role === "assistant";
        const showCaret =
          isStreamingAssistant && m.content.length > 0;
        const showDots =
          isStreamingAssistant && m.content.length === 0;

        return (
          <div
            key={m.id}
            className={cn(
              "text-[13px] leading-relaxed whitespace-pre-wrap transition-opacity duration-150",
              isUser ? "text-zinc-400" : "text-zinc-100",
            )}
          >
            {m.content}
            {showCaret && <StreamingCursor />}
            {showDots && <TypingIndicator className="inline-flex ml-0.5" />}
          </div>
        );
      })}
      {streaming &&
        messages.length > 0 &&
        messages[messages.length - 1].role !== "assistant" && (
          <TypingIndicator />
        )}
      <div ref={bottomRef} />
    </div>
  );
}