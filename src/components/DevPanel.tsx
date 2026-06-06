import { useState } from "react";
import {
  toggleOverlay as tauriToggleOverlay,
  openSettings,
  setClickThrough,
  getSettings,
} from "../lib/tauri";
import { useOverlayStore } from "../lib/store";

export function DevPanel() {
  const [clickThrough, setLocalClickThrough] = useState(false);
  const [settings, setSettings] = useState<{
    hotkey: string;
    model: string;
  } | null>(null);
  const visible = useOverlayStore((s) => s.visible);

  return (
    <div className="mt-8 p-4 rounded-lg border border-white/5 bg-card/40 text-xs space-y-3 max-w-md">
      <div className="font-semibold text-foreground">Dev Panel</div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Overlay visible</span>
        <span className="font-mono">{String(visible)}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Click-through</span>
        <button
          onClick={async () => {
            const next = !clickThrough;
            setLocalClickThrough(next);
            await setClickThrough(next);
          }}
          className="px-2 py-0.5 rounded bg-muted hover:bg-muted/70"
        >
          {clickThrough ? "ON" : "OFF"}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Toggle overlay</span>
        <button
          onClick={() => tauriToggleOverlay()}
          className="px-2 py-0.5 rounded bg-muted hover:bg-muted/70"
        >
          invoke
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Settings</span>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              const s = await getSettings();
              setSettings({ hotkey: s.hotkey, model: s.model });
            }}
            className="px-2 py-0.5 rounded bg-muted hover:bg-muted/70"
          >
            read
          </button>
          <button
            onClick={() => openSettings()}
            className="px-2 py-0.5 rounded bg-muted hover:bg-muted/70"
          >
            open window
          </button>
        </div>
      </div>

      {settings && (
        <pre className="mt-2 p-2 rounded bg-background/50 text-[10px] font-mono overflow-x-auto">
          {JSON.stringify(settings, null, 2)}
        </pre>
      )}
    </div>
  );
}
