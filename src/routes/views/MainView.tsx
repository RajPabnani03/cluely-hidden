/**
 * MainView — landing / profile picker.
 *
 * Shown after onboarding completes. Lets the user pick a profile, jump
 * to the Assistant view, and (eventually) review recent conversations.
 * For v0.1.0 the "Start Session" button is a no-op placeholder — the real
 * chat wiring lands in Phase 4.
 */

import { useEffect, useState } from "react";
import { ALL_PROFILE_IDS, PROFILE_LABELS, type ProfileId } from "../../lib/profiles";
import { useRouter } from "../../lib/router";
import {
  type AppSettings,
  getSettings,
  listConversations,
  type DbConversation,
} from "../../lib/tauri";
import { formatRelativeTime } from "../../lib/utils";

export function MainView() {
  const setView = useRouter((s) => s.setView);
  const [profile, setProfile] = useState<ProfileId>("interview");
  const [recent, setRecent] = useState<DbConversation[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    // Best-effort: surface the 3 most-recent conversations and current settings
    listConversations()
      .then((rows) => setRecent(rows.slice(0, 3)))
      .catch(console.error);
    getSettings()
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Cluely Hidden</h1>
        <p className="text-sm text-zinc-400">Stealth AI assistant</p>
      </header>

      {/* Profile picker + Start */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <div>
          <label htmlFor="profile-select" className="text-xs font-medium text-zinc-300">
            Profile
          </label>
          <select
            id="profile-select"
            value={profile}
            onChange={(e) => setProfile(e.target.value as ProfileId)}
            className="mt-1 w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ALL_PROFILE_IDS.map((id) => (
              <option key={id} value={id}>
                {PROFILE_LABELS[id]}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setView("assistant")}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-md px-3 py-2 text-sm font-medium transition-colors"
        >
          Start Session →
        </button>

        <p className="text-[11px] text-zinc-500 text-center">
          Press <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[10px]">⌘+Enter</kbd>{" "}
          to take a screenshot once in the Assistant.
        </p>
      </section>

      {/* API key quick-link */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2">
        <h2 className="text-sm font-medium">Need an API key?</h2>
        <p className="text-xs text-zinc-400">
          Cluely Hidden uses Google's Gemini API. Free key, no credit card.
        </p>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-blue-400 hover:text-blue-300 underline"
        >
          aistudio.google.com/apikey →
        </a>
      </section>

      {/* Recent conversations preview */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-300">Recent conversations</h2>
          <button
            onClick={() => setView("history")}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            See all →
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="text-xs text-zinc-500 rounded-lg border border-dashed border-zinc-800 p-3">
            No conversations yet. Start a session in the Assistant view.
          </p>
        ) : (
          <ul className="space-y-1">
            {recent.map((c) => (
              <li
                key={c.id}
                className="text-xs text-zinc-300 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 flex items-center justify-between"
              >
                <span className="truncate">{c.title ?? "Untitled"}</span>
                <span className="text-zinc-500 shrink-0 ml-2">
                  {formatRelativeTime(c.updated_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Footer: model indicator */}
      <footer className="pt-2 text-[11px] text-zinc-500">
        Model: {settings?.model ?? "—"} · {settings?.theme ?? "dark"} theme
      </footer>
    </div>
  );
}
