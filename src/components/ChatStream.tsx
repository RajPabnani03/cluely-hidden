import { useEffect, useRef } from "react";
import { useOverlayStore } from "../lib/store";
import { cn } from "../lib/utils";
import type { QuickAction } from "./QuickActionChips";

interface ChatStreamProps {
  mode: QuickAction;
}

/**
 * ChatStream — renders the response inside the Cluely-style card.
 *
 * Empty state adapts to the active mode. Messages are rendered as a single
 * consolidated assistant response (no bubbly iMessage style).
 */
export function ChatStream({ mode }: ChatStreamProps) {
  const messages = useOverlayStore((s) => s.messages);
  const streaming = useOverlayStore((s) => s.streaming);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, streaming]);

  const empty = messages.length === 0;

  if (empty) {
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

  return (
    <div className="px-1 py-3 space-y-4 min-h-[160px] max-h-[380px] overflow-y-auto scrollbar-thin">
      {messages.map((m) => {
        const isUser = m.role === "user";
        return (
          <div
            key={m.id}
            className={cn(
              "text-[13px] leading-relaxed whitespace-pre-wrap",
              isUser ? "text-zinc-400" : "text-zinc-100",
            )}
          >
            {m.content}
          </div>
        );
      })}
      {streaming && (
        <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-zinc-400 animate-pulse" />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
