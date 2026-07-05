/**
 * HelpView — secondary overlay sheet with hotkeys + FAQ.
 */
import { X } from "lucide-react";
import { useRouter } from "../../lib/router";
import { useOverlayStore } from "../../lib/store";
import { cn } from "../../lib/utils";

const HOTKEY_INFO: Array<{ action: string; label: string; description: string }> = [
  { action: "toggle_visibility", label: "Toggle overlay", description: "Show or hide the overlay window from anywhere." },
  { action: "next_step", label: "Assist", description: "Take a screenshot or trigger the active assistant mode." },
  { action: "emergency_erase", label: "Emergency erase", description: "Wipe in-memory state and hide the overlay. Use in panic." },
  { action: "toggle_click_through", label: "Toggle click-through", description: "Let clicks pass through the overlay to apps below." },
  { action: "move_up", label: "Move up", description: "Nudge the overlay window up." },
  { action: "move_down", label: "Move down", description: "Nudge the overlay window down." },
  { action: "move_left", label: "Move left", description: "Nudge the overlay window left." },
  { action: "move_right", label: "Move right", description: "Nudge the overlay window right." },
  { action: "previous_response", label: "Previous response", description: "Cycle back through past AI responses." },
  { action: "next_response", label: "Next response", description: "Cycle forward through past AI responses." },
  { action: "scroll_up", label: "Scroll up", description: "Scroll the response area up." },
  { action: "scroll_down", label: "Scroll down", description: "Scroll the response area down." },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "How does it stay invisible?",
    a: "The overlay window is content-protected (screen-capture blockers skip it) and hidden from the Dock on macOS. Screen-share apps like Zoom, Meet, and Teams see a transparent layer instead of your AI.",
  },
  {
    q: "Where is my data stored?",
    a: "Locally in a SQLite database inside the Tauri app data directory. Nothing leaves your machine unless you enable Google Search.",
  },
  {
    q: "Can I rebind hotkeys?",
    a: "In-app rebinding is not yet wired. Edit src-tauri/tauri.conf.json and restart the app.",
  },
  {
    q: "Which AI providers are supported?",
    a: "Google Gemini (gemini-2.5-flash, gemini-2.5-pro). Ollama and local model support is planned.",
  },
  {
    q: "What if someone walks up to my screen?",
    a: "Hit ⌘+Shift+E immediately. The overlay hides, the session clears, and in-memory state is wiped.",
  },
];

export function HelpView() {
  const back = useRouter((s) => s.backToAssistant);
  const hotkeyBindings = useOverlayStore((s) => s.hotkeyBindings);
  const map: Record<string, string> = {};
  for (const [action, key] of hotkeyBindings) {
    map[action] = key;
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div
        className={cn(
          "w-full max-w-[420px] max-h-[85vh] flex flex-col rounded-[20px] overflow-hidden",
          "bg-zinc-900/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl"
        )}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-zinc-100">Help</h2>
          <button
            onClick={back}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4 space-y-5">
          <Section title="Hotkeys">
            <ul className="space-y-2">
              {HOTKEY_INFO.map((h) => (
                <li
                  key={h.action}
                  className="flex items-start justify-between gap-4 text-sm"
                >
                  <div className="min-w-0">
                    <div className="text-zinc-200">{h.label}</div>
                    <div className="text-[11px] text-zinc-500">{h.description}</div>
                  </div>
                  <kbd className="shrink-0 font-mono text-[10px] bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-300 self-center">
                    {map[h.action] ?? "—"}
                  </kbd>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="FAQ">
            <dl className="space-y-3">
              {FAQ.map((item) => (
                <div key={item.q}>
                  <dt className="text-sm font-medium text-zinc-200">{item.q}</dt>
                  <dd className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          <footer className="pt-3 border-t border-zinc-800 text-[10px] text-zinc-500 flex items-center justify-between">
            <span>Cluely Hidden v0.3.0</span>
            <a
              href="https://github.com/rajpabnani/cluely-hidden"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300"
            >
              View source
            </a>
          </footer>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{title}</h3>
      {children}
    </section>
  );
}
