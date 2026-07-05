import { useEffect } from "react";
import { useOverlayStore } from "./lib/store";
import { useRouter } from "./lib/router";
import { syncBuiltinProfilesToDb } from "./lib/profiles";
import { AssistantView } from "./routes/views/AssistantView";
import { SettingsView } from "./routes/views/SettingsView";
import { HistoryView } from "./routes/views/HistoryView";
import { HelpView } from "./routes/views/HelpView";
import { onOverlayVisibilityChange, onClearSensitiveData } from "./lib/tauri";
import { DevPanel } from "./components/DevPanel";

/**
 * Single-window overlay app.
 *
 * The assistant card is always the base layer. Secondary views
 * (settings, history, help) render as modal sheets on top of it.
 */
export default function App() {
  const visible = useOverlayStore((s) => s.visible);
  const currentView = useRouter((s) => s.currentView);
  const setVisible = useOverlayStore((s) => s.setVisible);
  const loadHotkeyBindings = useOverlayStore((s) => s.loadHotkeyBindings);
  const resetSensitiveState = useOverlayStore((s) => s.resetSensitiveState);

  // Initial loads — hotkey bindings + builtin profile prompts
  useEffect(() => {
    loadHotkeyBindings();
    syncBuiltinProfilesToDb();
  }, [loadHotkeyBindings]);

  // Visibility event from Rust (hotkey / tray)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onOverlayVisibilityChange((v) => setVisible(v))
      .then((fn) => {
        unlisten = fn;
      })
      .catch(console.error);
    return () => unlisten?.();
  }, [setVisible]);

  // Emergency erase — wipe in-memory state
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onClearSensitiveData(() => {
      resetSensitiveState();
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(console.error);
    return () => unlisten?.();
  }, [resetSensitiveState]);

  if (!visible) return null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent text-zinc-100">
      <AssistantView />

      {currentView === "settings" && <SettingsView />}
      {currentView === "history" && <HistoryView />}
      {currentView === "help" && <HelpView />}

      {import.meta.env.DEV && (
        <div className="fixed bottom-4 right-4 w-72 z-50">
          <DevPanel />
        </div>
      )}
    </div>
  );
}
