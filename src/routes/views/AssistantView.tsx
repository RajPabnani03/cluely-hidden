/**
 * AssistantView — the live AI assistant.
 *
 * In v0.1.0 this is the old Overlay.tsx content (title bar, chat stream,
 * input bar) re-housed inside the new single-window view architecture.
 * In Phase 4 it will grow: audio recording UI, screenshot previews,
 * speaker diarization labels, and the 2-model latency status row.
 *
 * The status pill at the top mirrors cheating-daddy's "Listening… /
 * Reconnecting…" pattern. For now it shows a static "ready" state.
 */

import { useEffect } from "react";
import { Eye, MousePointer2, X } from "lucide-react";
import { useOverlayStore } from "../../lib/store";
import { useRouter } from "../../lib/router";
import { ChatStream } from "../../components/ChatStream";
import { InputBar } from "../../components/InputBar";
import {
  hideOverlay,
  onShortcutTriggered,
  setClickThrough as tauriSetClickThrough,
} from "../../lib/tauri";
import { cn } from "../../lib/utils";

type AssistantStatus = "ready" | "listening" | "reconnecting" | "error";

export function AssistantView() {
  const clickThrough = useOverlayStore((s) => s.clickThrough);
  const setClickThrough = useOverlayStore((s) => s.setClickThrough);
  const messages = useOverlayStore((s) => s.messages);
  const streaming = useOverlayStore((s) => s.streaming);
  const clearMessages = useOverlayStore((s) => s.clearMessages);
  const setView = useRouter((s) => s.setView);

  // Listen for "next_step" — in Phase 4 this will trigger a screenshot
  // capture. For now it just focuses the input bar (no-op since we don't
  // have a ref, but the subscription is wired correctly).
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onShortcutTriggered((action) => {
      if (action === "next_step") {
        // Phase 4 will: captureScreenshot() → append user msg → chat()
        // For v0.1, just make sure we're on the assistant view.
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
          <Eye className="w-3.5 h-3.5" />
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
          <button
            onClick={async () => {
              const next = !clickThrough;
              setClickThrough(next);
              try {
                await tauriSetClickThrough(next);
              } catch (err) {
                console.error("setClickThrough failed:", err);
              }
            }}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              clickThrough
                ? "bg-blue-600/20 text-blue-400"
                : "hover:bg-zinc-800 text-zinc-400",
            )}
            title={
              clickThrough
                ? "Click-through ON — overlay ignores clicks"
                : "Click-through OFF — overlay captures clicks"
            }
          >
            {clickThrough ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <MousePointer2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => hideOverlay().catch(console.error)}
            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 transition-colors"
            title="Hide overlay (⌘+\\)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
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
