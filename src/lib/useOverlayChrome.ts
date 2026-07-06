import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useRouter } from "./router";
import { useOverlayStore } from "./store";
import { getSettings } from "./tauri";

/** Global overlay chrome events from Rust (tray, hotkeys, stealth). */
export function useOverlayChrome() {
  const setView = useRouter((s) => s.setView);
  const setClickThrough = useOverlayStore((s) => s.setClickThrough);
  const setOverlayLayout = useOverlayStore((s) => s.setOverlayLayout);
  const setStealthTier = useOverlayStore((s) => s.setStealthTier);
  const setOverlayOpacity = useOverlayStore((s) => s.setOverlayOpacity);
  const loadHotkeyBindings = useOverlayStore((s) => s.loadHotkeyBindings);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setOverlayLayout(s.overlayLayout === "compact" ? "compact" : "full");
        setStealthTier(s.stealthTier ?? "glass");
        setOverlayOpacity(s.overlayOpacity ?? 0.92);
      })
      .catch(console.error);
  }, [
    setOverlayLayout,
    setStealthTier,
    setOverlayOpacity,
  ]);

  useEffect(() => {
    const unsubs: UnlistenFn[] = [];
    const safe = (p: Promise<UnlistenFn>) =>
      p.then((fn) => unsubs.push(fn)).catch(console.error);

    safe(
      listen<string>("overlay:navigate", (e) => {
        const v = e.payload;
        if (v === "settings" || v === "history" || v === "help") {
          setView(v);
        }
      }),
    );
    safe(
      listen<boolean>("overlay:click_through", (e) => {
        setClickThrough(!!e.payload);
      }),
    );
    safe(
      listen<string>("overlay:layout", (e) => {
        const layout = e.payload === "compact" ? "compact" : "full";
        setOverlayLayout(layout);
      }),
    );
    safe(
      listen<string>("overlay:stealth_tier", (e) => {
        if (typeof e.payload === "string") {
          setStealthTier(e.payload);
          getSettings()
            .then((s) => setOverlayOpacity(s.overlayOpacity ?? 0.92))
            .catch(() => {});
        }
      }),
    );

    return () => {
      for (const fn of unsubs) {
        try {
          fn();
        } catch {
          /* ignore */
        }
      }
    };
  }, [setView, setClickThrough, setOverlayLayout, setStealthTier, setOverlayOpacity]);

  useEffect(() => {
    loadHotkeyBindings();
  }, [loadHotkeyBindings]);
}