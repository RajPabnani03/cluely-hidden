import { X } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { CaptureMeta } from "../lib/tauri";
import { cn } from "../lib/utils";

const MAX_TRAY = 3;

interface ScreenshotTrayProps {
  items: CaptureMeta[];
  onRemove: (id: string) => void;
  onClear: () => void;
  className?: string;
}

/** Up to three captures before sending to the model (Pluely-style tray). */
export function ScreenshotTray({
  items,
  onRemove,
  onClear,
  className,
}: ScreenshotTrayProps) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "px-4 pb-2 flex items-center gap-2 flex-wrap",
        className,
      )}
      data-tauri-no-drag
    >
      <span className="text-[10px] text-zinc-500 w-full">
        Screenshot tray ({items.length}/{MAX_TRAY})
      </span>
      {items.map((cap) => (
        <div
          key={cap.id}
          className="relative group rounded-lg overflow-hidden border border-zinc-700/60 w-16 h-10 bg-zinc-900"
        >
          <img
            src={convertFileSrc(cap.path)}
            alt="capture"
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => onRemove(cap.id)}
            className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/70 text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Remove capture"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      {items.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] text-zinc-500 hover:text-zinc-200 underline"
        >
          Clear tray
        </button>
      )}
    </div>
  );
}

export { MAX_TRAY };