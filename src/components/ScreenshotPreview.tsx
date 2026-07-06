import { useEffect, useState } from "react";
import { Camera, X } from "lucide-react";
import { cn } from "../lib/utils";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { convertFileSrc } from "@tauri-apps/api/core";

interface ScreenshotMeta {
  id: string;
  path: string;
  width: number;
  height: number;
  created_at: number;
}

/**
 * Screenshot preview card — shows the last captured screen as a small
 * thumbnail above the response area (Cluely shows a similar "Viewed
 * screen" pill above the streaming response).
 *
 * Listens for the Rust `capture:screen` event and updates accordingly.
 * User can dismiss the thumbnail with the X button.
 */
export function ScreenshotPreview() {
  const [capture, setCapture] = useState<ScreenshotMeta | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    const sub = listen<ScreenshotMeta>("capture:screen", (e) => {
      setCapture(e.payload);
      setDismissed(false);
    });
    sub
      .then((fn) => {
        unlisten = fn;
      })
      .catch(console.error);
    return () => {
      unlisten?.();
    };
  }, []);

  if (!capture || dismissed) return null;

  // Tauri can serve local files via the asset protocol when the path
  // is registered. Fall back to a placeholder if conversion fails.
  const src = (() => {
    try {
      return convertFileSrc(capture.path);
    } catch {
      return null;
    }
  })();

  return (
    <div
      className={cn(
        "mx-4 mb-2 rounded-xl overflow-hidden",
        "bg-zinc-900/60 border border-white/[0.08]",
        "backdrop-blur-xl",
      )}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <Camera className="w-3 h-3 text-zinc-400" />
          <span className="text-[10.5px] font-medium text-zinc-300">
            Viewed screen
          </span>
          <span className="text-[10px] text-zinc-500 tabular-nums">
            {capture.width}×{capture.height}
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          aria-label="Dismiss screenshot preview"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="aspect-[16/9] bg-zinc-950 flex items-center justify-center">
        {src ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={src}
            alt="Most recently captured screen"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-zinc-500">
            <Camera className="w-5 h-5" />
            <span className="text-[10px]">{capture.path}</span>
          </div>
        )}
      </div>
    </div>
  );
}