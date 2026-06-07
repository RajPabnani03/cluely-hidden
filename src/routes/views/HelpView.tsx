/**
 * HelpView — keyboard shortcuts + FAQ + version footer.
 *
 * Pulls the live hotkey bindings from the store so the user always sees
 * the actual current bindings (after any rebind). The 11 hotkeys are
 * rendered in a fixed order matching the OnboardingView's hotkeys step.
 */

import { useOverlayStore } from "../../lib/store";

const HOTKEY_INFO: Array<{ action: string; label: string; description: string }> = [
  { action: "toggle_visibility", label: "Toggle overlay", description: "Show or hide the overlay window from anywhere." },
  { action: "next_step", label: "Next step", description: "Take a screenshot (or start a session if none active)." },
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
    a: "Locally in a SQLite database inside the Tauri app data directory. Nothing leaves your machine unless you enable Google Search (in which case queries go to Google).",
  },
  {
    q: "Can I rebind hotkeys?",
    a: "In-app rebinding lands in Phase 4. For now, edit src-tauri/tauri.conf.json and restart the app.",
  },
  {
    q: "Which AI providers are supported?",
    a: "Google Gemini (gemini-2.5-flash, gemini-2.5-pro) in v0.1.0. Ollama and local model support land in Phase 7.",
  },
  {
    q: "What if someone walks up to my screen?",
    a: "Hit ⌘+Shift+E (Cmd+Shift+E) immediately. The overlay hides, the AI session ends, and in-memory state is cleared.",
  },
];

export function HelpView() {
  const hotkeyBindings = useOverlayStore((s) => s.hotkeyBindings);
  const map: Record<string, string> = {};
  for (const [action, key] of hotkeyBindings) {
    map[action] = key;
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-6 max-w-2xl mx-auto w-full">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Help</h1>
        <p className="text-sm text-zinc-400">
          Hotkeys, FAQ, and feedback.
        </p>
      </header>

      <Section title="Hotkeys">
        <ul className="divide-y divide-zinc-800 -mx-1">
          {HOTKEY_INFO.map((h) => (
            <li
              key={h.action}
              className="flex items-start justify-between gap-4 px-1 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-sm text-zinc-200">{h.label}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  {h.description}
                </div>
              </div>
              <kbd className="shrink-0 font-mono text-xs bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-zinc-200 self-center">
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
              <dd className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Feedback">
        <p className="text-sm text-zinc-300">
          Found a bug? Want a feature? Drop us a line.
        </p>
        <a
          href="mailto:hello@cluely-hidden.local?subject=Cluely%20Hidden%20Feedback"
          className="inline-block mt-2 text-sm text-blue-400 hover:text-blue-300 underline"
        >
          hello@cluely-hidden.local →
        </a>
      </Section>

      <footer className="pt-4 border-t border-zinc-800 text-[11px] text-zinc-500 flex items-center justify-between">
        <span>Cluely Hidden v0.1.0</span>
        <span>
          Phase 3C ·{" "}
          <a
            href="https://github.com/rajpabnani/cluely-hidden"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-300"
          >
            View source
          </a>
        </span>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2">
      <h2 className="text-sm font-medium text-zinc-200">{title}</h2>
      {children}
    </section>
  );
}
