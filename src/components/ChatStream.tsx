import { useEffect, useRef } from "react";
import { useOverlayStore } from "../lib/store";
import { cn } from "../lib/utils";

export function ChatStream() {
  const messages = useOverlayStore((s) => s.messages);
  const streaming = useOverlayStore((s) => s.streaming);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streaming]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-8 text-center">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Ask anything. Capture your screen or voice.
          </p>
          <p className="text-xs text-muted-foreground/50">
            ⌘+Shift+Space to hide
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-3">
      {messages.map((m, i) => {
        const isUser = m.role === "user";
        const isLast = i === messages.length - 1;
        return (
          <div
            key={m.id}
            className={cn(
              "flex",
              isUser ? "justify-end" : "justify-start",
              "animate-fade-in",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                "leading-relaxed whitespace-pre-wrap break-words",
                isUser
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm",
              )}
            >
              {m.content}
              {!isUser && isLast && streaming && (
                <span className="inline-block w-1.5 h-3.5 ml-1 align-text-bottom bg-foreground/70 animate-pulse-soft" />
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
