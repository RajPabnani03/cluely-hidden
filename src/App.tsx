import { useEffect } from "react";
import { useOverlayStore } from "./lib/store";
import { useRouter } from "./lib/router";
import { syncBuiltinProfilesToDb } from "./lib/profiles";
import { Sidebar } from "./components/Sidebar";
import { MainView } from "./routes/views/MainView";
import { AssistantView } from "./routes/views/AssistantView";
import { OnboardingView } from "./routes/views/OnboardingView";
import { CustomizeView } from "./routes/views/CustomizeView";
import { AICustomizeView } from "./routes/views/AICustomizeView";
import { HistoryView } from "./routes/views/HistoryView";
import { HelpView } from "./routes/views/HelpView";
import { onOverlayVisibilityChange, onClearSensitiveData } from "./lib/tauri";
import { DevPanel } from "./components/DevPanel";

/**
 * Single-window, multi-view app.
 *
 * The window is a flex row: 60px Sidebar + flex-1 active view.
 * The view is driven by `useRouter()` (zustand). Onboarding is gated:
 * when the overlay becomes visible and the user hasn't onboarded yet,
 * we route them to the Onboarding view automatically.
 *
 * Production: only renders content when the overlay is visible. The
 * overlay window itself is a separate Tauri webview; when it's hidden
 * the app returns null.
 *
 * Dev mode: a small DevPanel is rendered alongside so the developer can
 * toggle visibility without leaving the main window.
 */
export default function App() {
  const visible = useOverlayStore((s) => s.visible);
  const currentView = useRouter((s) => s.currentView);
  const hasOnboarded = useRouter((s) => s.hasOnboarded);
  const setView = useRouter((s) => s.setView);

  const loadHotkeyBindings = useOverlayStore((s) => s.loadHotkeyBindings);
  const resetSensitiveState = useOverlayStore((s) => s.resetSensitiveState);
  const setVisible = useOverlayStore((s) => s.setVisible);

  // Initial loads — hotkey bindings + builtin profile prompts
  useEffect(() => {
    loadHotkeyBindings();
    syncBuiltinProfilesToDb();
  }, [loadHotkeyBindings]);

  // Onboarding gate — first time the overlay opens, force-routes to the wizard
  useEffect(() => {
    if (visible && !hasOnboarded) {
      setView("onboarding");
    }
  }, [visible, hasOnboarded, setView]);

  // Visibility event from Rust (hotkey / tray)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onOverlayVisibilityChange((v) => setVisible(v))
      .then((fn) => {
        unlisten = fn;
      })
      .catch(console.error);
    return () => {
      unlisten?.();
    };
  }, [setVisible]);

  // Emergency erase — wipe in-memory state, go to main view
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onClearSensitiveData(() => {
      console.warn("emergency erase: clearing sensitive frontend state");
      resetSensitiveState();
      setView("main");
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(console.error);
    return () => {
      unlisten?.();
    };
  }, [resetSensitiveState, setView]);

  // Hidden: don't render anything
  if (!visible) return null;

  // Pick the active view component
  const View = {
    main: MainView,
    assistant: AssistantView,
    onboarding: OnboardingView,
    customize: CustomizeView,
    "ai-customize": AICustomizeView,
    history: HistoryView,
    help: HelpView,
  }[currentView];

  // Dev escape hatch: a small panel so the dev can toggle the overlay
  // without leaving the page. In production this is unused.
  if (import.meta.env.DEV) {
    return (
      <>
        <div className="flex h-screen w-screen bg-zinc-900 text-zinc-100">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <View />
          </main>
        </div>
        <div className="fixed bottom-4 right-4 w-72 z-50">
          <DevPanel />
        </div>
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-zinc-900 text-zinc-100">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <View />
      </main>
    </div>
  );
}
