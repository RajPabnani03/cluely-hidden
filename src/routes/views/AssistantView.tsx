/**
 * AssistantView — the live AI assistant.
 *
 * The title bar shows the brand, a live status pill, and the message
 * count. Window controls (click-through, hide) live in the Sidebar so we
 * don't duplicate them here.
 */

import { useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { useOverlayStore } from "../../lib/store";
import { useRouter } from "../../lib/router";
import { ChatStream } from "../../components/ChatStream";
import { InputBar } from "../../components/InputBar";
import { onShortcutTriggered } from "../../lib/tauri";
import { cn } from "../../lib/utils";

type AssistantStatus = "ready" | "listening" | "reconnecting" | "error";

export function AssistantView() {
  const messages = useOverlayStore((s) => s.messages);
  const streaming = useOverlayStore((s) => s.streaming);
  const clearMessages = useOverlayStore((s) => s.clearMessages);
  const setView = useRouter((s) => s.setView);

  // Listen for "next_step" — in a future release this will trigger a
  // screenshot capture. For now it just switches to the assistant view.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onShortcutTriggered((action) => {
      if (action === "next_step") {
        setView("assistant");
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(console.error);
    return () => {
      unlisten?.();
    };
  }, [setView]);

  const status: AssistantStatus = streaming ? "listening" : "ready";

  return (
    <div className="h-full flex flex-col">
      {/* Title bar */}
      <div
        className={cn(
          "flex items-center justify-between px-4 h-10 border-b border-zinc-800 shrink-0",
          "bg-zinc-950/40",
        )}
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="font-medium text-zinc-200">Cluely</span>
          <span className="opacity-50">·</span>
          <StatusPill status={status} />
          <span className="opacity-50">·</span>
          <span className="opacity-70">
            {messages.length === 0
              ? "ready"
              : `${messages.length} message${messages.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="flex items-center gap-1" data-tauri-no-drag>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="px-2 py-1 rounded-md text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
              title="Clear conversation"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Chat stream */}
      <div className="flex-1 overflow-y-auto">
        <ChatStream />
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-zinc-800 p-3">
        <InputBar />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: AssistantStatus }) {
  const map: Record<AssistantStatus, { label: string; dot: string; text: string }> = {
    ready: { label: "ready", dot: "bg-emerald-400", text: "text-emerald-300" },
    listening: { label: "Listening…", dot: "bg-blue-400", text: "text-blue-300" },
    reconnecting: { label: "Reconnecting…", dot: "bg-amber-400", text: "text-amber-300" },
    error: { label: "Error", dot: "bg-red-400", text: "text-red-300" },
  };
  const s = map[status];
  return (
    <span className={cn("flex items-center gap-1.5", s.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse-soft", s.dot)} />
      {s.label}
    </span>
  );
}
