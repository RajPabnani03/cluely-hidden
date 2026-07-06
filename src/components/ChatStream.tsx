import { useEffect, useMemo, useRef } from "react";
import { useOverlayStore } from "../lib/store";
import { cn } from "../lib/utils";
import type { QuickAction } from "./QuickActionChips";
import { TypingIndicator } from "./TypingIndicator";
import { StreamingCursor } from "./StreamingCursor";

interface ChatStreamProps {
  mode: QuickAction;
  /** When teleprompter shows dual-brain line, collapse duplicate in stream */
  hideWhenSpeakable?: boolean;
  speakableText?: string;
}

const MODE_HINT: Record<QuickAction, string> = {
  assist: "Ask about your screen or conversation",
  say: "Describe the moment — I'll suggest what to say",
  followup: "Ask a follow-up about the meeting",
  recap: "Summarize what happened so far",
};

/**
 * ChatStream — secondary thread under the hero response.
 */
export function ChatStream({
  mode,
  hideWhenSpeakable,
  speakableText,
}: ChatStreamProps) {
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

  if (
    hideWhenSpeakable &&
    speakableText?.trim() &&
    empty &&
    !streaming
  ) {
    return null;
  }

  if (empty && !streaming) {
    return (
      <div className="flex flex-col justify-center min-h-[120px] px-1 py-2 text-center">
        <p className="text-[15px] text-zinc-200 font-medium tracking-tight">
          {MODE_HINT[mode]}
        </p>
        <p className="mt-2 text-[11px] text-zinc-500 leading-relaxed max-w-[320px] mx-auto">
          Press{" "}
          <kbd className="px-1.5 py-0.5 rounded-md bg-zinc-800/90 border border-zinc-700/80 font-mono text-[10px] text-zinc-300">
            ⌘↵
          </kbd>{" "}
          during a live session for instant assist, or type below.
        </p>
      </div>
    );
  }

  if (showLiveEmptyTyping) {
    return (
      <div className="flex items-center min-h-[120px] px-1 py-2">
        <TypingIndicator />
      </div>
    );
  }

  const showUserLines = messages.some((m) => m.role === "user");

  return (
    <div
      id="assistant-scroll-region"
      className={cn(
        "px-1 py-2 space-y-3 min-h-[80px] max-h-[280px] overflow-y-auto scrollbar-thin",
        !showUserLines && "max-h-[320px]",
      )}
    >
      {messages.map((m, index) => {
        const isUser = m.role === "user";
        const isLast = index === messages.length - 1;
        const isStreamingAssistant =
          !isUser && isLast && streaming && m.role === "assistant";
        const showCaret =
          isStreamingAssistant && m.content.length > 0;
        const showDots =
          isStreamingAssistant && m.content.length === 0;

        if (
          hideWhenSpeakable &&
          speakableText?.trim() &&
          !isUser &&
          isLast &&
          m.content === speakableText
        ) {
          return null;
        }

        return (
          <div
            key={m.id}
            className={cn(
              "leading-relaxed whitespace-pre-wrap transition-opacity duration-150",
              isUser
                ? "text-[11px] text-zinc-500"
                : "text-[14px] text-zinc-100",
            )}
          >
            {isUser && (
              <span className="text-[10px] uppercase tracking-wide text-zinc-600 block mb-0.5">
                You
              </span>
            )}
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