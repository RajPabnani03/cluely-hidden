import { useEffect, useState } from "react";
import {
  EyeOff,
  Square,
  MoreHorizontal,
} from "lucide-react";
import { useOverlayStore } from "../../lib/store";
import { useRouter } from "../../lib/router";
import { ChatStream } from "../../components/ChatStream";
import { InputBar } from "../../components/InputBar";
import { QuickActionChips, type QuickAction } from "../../components/QuickActionChips";
import { onShortcutTriggered, hideOverlay } from "../../lib/tauri";
import { CardShell } from "../../components/ui";
import { cn } from "../../lib/utils";

type HeaderStatus = "ready" | "listening" | "thinking";

/**
 * AssistantView — Cluely-style floating overlay card.
 *
 * A single vertical panel:
 *   • Header: logo pill + listening status + Hide/Stop controls
 *   • Response area: streaming response + quick-action chips
 *   • Input bar: Smart toggle + text input + mic/send button
 *
 * Uses the zinc palette + glassmorphism from the official UX.
 */
export function AssistantView() {
  const messages = useOverlayStore((s) => s.messages);
  const streaming = useOverlayStore((s) => s.streaming);
  const clearMessages = useOverlayStore((s) => s.clearMessages);
  const setView = useRouter((s) => s.setView);

  const [activeChip, setActiveChip] = useState<QuickAction>("assist");
  const [showMenu, setShowMenu] = useState(false);

  // Listen for the main assist hotkey to switch to Assist mode.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onShortcutTriggered((action) => {
      if (action === "next_step") {
        setActiveChip("assist");
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(console.error);
    return () => unlisten?.();
  }, []);

  const status: HeaderStatus = streaming
    ? "thinking"
    : messages.length === 0
      ? "ready"
      : "listening";

  const stopEverything = () => {
    clearMessages();
    setActiveChip("assist");
  };

  return (
    <div className="h-full w-full flex items-start justify-center p-4 bg-transparent">
      <CardShell className="max-h-[85vh]">
        {/* Header — draggable, no-drag buttons */}
        <header
          className="relative flex items-center justify-between px-3 py-3 border-b border-white/[0.06] shrink-0 select-none"
          data-tauri-drag-region
        >
          {/* Logo pill */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center">
              <span className="text-zinc-900 text-[10px] font-bold">C</span>
            </div>
            <span className="text-[11px] font-semibold text-zinc-200 tracking-tight">
              Cluely
            </span>
          </div>

          {/* Status pill, absolutely centered */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 text-[11px] font-medium text-zinc-200 border border-zinc-700/60">
              <StatusDot status={status} />
              {status === "ready" && "Ready"}
              {status === "listening" && "Listening live"}
              {status === "thinking" && "Thinking…"}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1" data-tauri-no-drag>
            <button
              onClick={stopEverything}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              title="Stop and clear"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
            <button
              onClick={() => hideOverlay().catch(console.error)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              title="Hide overlay"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Hide
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu((s) => !s)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                aria-label="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-36 rounded-xl border border-zinc-700/60 bg-zinc-900/95 backdrop-blur-xl shadow-xl py-1 z-50"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  {[
                    ["settings", "Settings"],
                    ["history", "History"],
                    ["help", "Help"],
                  ].map(([view, label]) => (
                    <button
                      key={view}
                      onClick={() => {
                        setShowMenu(false);
                        setView(view as "settings" | "history" | "help");
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mode prompt pill */}
        <div className="px-4 pt-4 pb-1 shrink-0">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/60">
            <span className="text-[11px] font-medium text-zinc-200">
              {activeChip === "assist" && "Assist"}
              {activeChip === "say" && "What should I say?"}
              {activeChip === "followup" && "Follow-up questions"}
              {activeChip === "recap" && "Recap"}
            </span>
          </div>
        </div>

        {/* Response area */}
        <div className="flex-1 min-h-0 px-4">
          <ChatStream mode={activeChip} />
        </div>

        {/* Quick action chips */}
        <div className="px-4 py-3 shrink-0">
          <QuickActionChips active={activeChip} onSelect={setActiveChip} />
        </div>

        {/* Input bar */}
        <div className="p-3 border-t border-white/[0.06] shrink-0">
          <InputBar mode={activeChip} />
        </div>
      </CardShell>
    </div>
  );
}

function StatusDot({ status }: { status: HeaderStatus }) {
  const color =
    status === "ready"
      ? "bg-emerald-400"
      : status === "listening"
        ? "bg-blue-400"
        : "bg-amber-400 animate-pulse";
  return <span className={cn("w-1.5 h-1.5 rounded-full", color)} />;
}
