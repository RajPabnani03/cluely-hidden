import { useEffect } from "react";
import {
  onOverlayVisibilityChange,
  toggleOverlay as tauriToggleOverlay,
} from "./lib/tauri";
import { useOverlayStore } from "./lib/store";
import { Overlay } from "./routes/Overlay";
import { DevPanel } from "./components/DevPanel";

export default function App() {
  const visible = useOverlayStore((s) => s.visible);
  const setVisible = useOverlayStore((s) => s.setVisible);

  // Listen for visibility events from Rust (hotkey / tray)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onOverlayVisibilityChange((v) => setVisible(v)).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [setVisible]);

  // Dev-only escape hatch: dev panel in the corner of the main window
  if (import.meta.env.DEV) {
    return (
      <>
        <div className="min-h-screen bg-background text-foreground p-8">
          <h1 className="text-2xl font-semibold mb-2">Cluely Hidden</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Dev mode. The overlay is a separate Tauri window — toggle it with
            the hotkey or the button below.
          </p>
          <button
            onClick={() => tauriToggleOverlay()}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Toggle Overlay
          </button>
          <DevPanel />
        </div>
        {visible && <Overlay />}
      </>
    );
  }

  // Production: only render the overlay (main window is hidden)
  return visible ? <Overlay /> : null;
}
