import { X, Minus, Square, MousePointer2, Eye } from "lucide-react";
import { useOverlayStore } from "../lib/store";
import { ChatStream } from "../components/ChatStream";
import { InputBar } from "../components/InputBar";
import {
  hideOverlay,
  setClickThrough,
} from "../lib/tauri";
import { cn } from "../lib/utils";

export function Overlay() {
  const clickThrough = useOverlayStore((s) => s.clickThrough);
  const setClickThrough = useOverlayStore((s) => s.setClickThrough);
  const messages = useOverlayStore((s) => s.messages);

  const handleClose = async () => {
    await hideOverlay();
  };

  const handleToggleClickThrough = async () => {
    const next = !clickThrough;
    setClickThrough(next);
    await setClickThroughZ(next);
  };

  return (
    <div
      className="fixed inset-0 pointer-events-none flex items-end justify-end p-6"
      data-tauri-drag-region
    >
      <div
        className={cn(
          "pointer-events-auto",
          "w-[420px] h-[600px]",
          "glass rounded-2xl shadow-2xl",
          "flex flex-col overflow-hidden",
          "animate-slide-up",
        )}
      >
        {/* Title bar */}
        <div
          className="tauri-drag flex items-center justify-between px-4 h-10 border-b border-white/5 shrink-0"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Eye className="w-3.5 h-3.5" />
            <span className="font-medium">Cluely</span>
            <span className="opacity-50">·</span>
            <span className="opacity-70">
              {messages.length === 0
                ? "ready"
                : `${messages.length} message${messages.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <div className="tauri-no-drag flex items-center gap-1">
            <button
              onClick={handleToggleClickThrough}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                clickThrough
                  ? "bg-primary/20 text-primary"
                  : "hover:bg-white/5 text-muted-foreground",
              )}
              title={
                clickThrough
                  ? "Click-through ON — overlay ignores clicks"
                  : "Click-through OFF — overlay captures clicks"
              }
            >
              <MousePointer2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground"
              title="Hide overlay (⌘+Shift+Space)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Chat stream */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <ChatStream />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-white/5 p-3">
          <InputBar />
        </div>
      </div>
    </div>
  );
}

// Keep file self-contained — wired to Rust command
async function setClickThroughZ(enabled: boolean) {
  try {
    await setClickThrough(enabled);
  } catch (err) {
    console.error("setClickThrough failed:", err);
  }
}
