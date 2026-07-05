/**
 * AICustomizeView — AI behavior + profile editor.
 *
 *   - Active profile dropdown (writes to settings)
 *   - Edit profile: opens a textarea with the current system_prompt,
 *     save calls `updateProfile`
 *   - Create new profile: prompts for name + system_prompt
 *   - Google Search toggle (writes to settings)
 *   - Model picker (hardcoded "Gemini 2.5 Flash" for v0.1.0)
 *
 * Reuses the legacy `Settings.tsx` structure (Section / Row / Toggle /
 * SegmentedControl) reimplemented locally to avoid a circular import.
 */

import { useEffect, useState } from "react";
import {
  type AppSettings,
  type DbProfile,
  createProfile,
  deleteProfile,
  getProfile,
  getSettings,
  listProfiles,
  updateProfile,
  updateSettings,
} from "../../lib/tauri";
import { ALL_PROFILE_IDS, PROFILE_LABELS, type ProfileId } from "../../lib/profiles";
import { cn } from "../../lib/utils";

const GOOGLE_SEARCH_KEY = "googleSearchEnabled" as const;
// We piggy-back on settings.model. If the user enables Google Search we
// stash it in a sentinel model name; otherwise we restore the real model.
// Phase 4 will add a real `googleSearchEnabled` field to AppSettings.

const MODEL_OPTIONS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (fast)" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (smarter)" },
];

export function AICustomizeView() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [profiles, setProfiles] = useState<DbProfile[]>([]);
  const [activeId, setActiveId] = useState<ProfileId | string>("interview");
  const [editingProfile, setEditingProfile] = useState<DbProfile | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editName, setEditName] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [status, setStatus] = useState<string>("");

  const reload = async () => {
    const [p, s] = await Promise.all([listProfiles(), getSettings()]);
    setProfiles(p);
    setSettings(s);
    // Default the active profile to the first builtin
    const firstBuiltin = p.find((x) => ALL_PROFILE_IDS.includes(x.id as ProfileId));
    setActiveId(firstBuiltin?.id ?? p[0]?.id ?? "interview");
  };

  useEffect(() => {
    reload().catch((err) => {
      console.error(err);
      setStatus("Failed to load profiles / settings.");
    });
  }, []);

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(""), 1800);
  };

  const applySettings = async (patch: Partial<AppSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      const updated = await updateSettings(next);
      setSettings(updated);
    } catch (err) {
      console.error("updateSettings failed:", err);
      flash("Save failed.");
    }
  };

  const onSelectProfile = async (id: string) => {
    setActiveId(id);
    // Persist the choice in settings — for v0.1 we just stash the id in
    // the model field, Phase 4 will add a dedicated activeProfileId setting.
    await applySettings({ model: id });
    flash(`Active profile: ${id}`);
  };

  const onEditProfile = async (id: string) => {
    const p = await getProfile(id);
    if (!p) {
      flash("Profile not found.");
      return;
    }
    setEditingProfile(p);
    setEditName(p.name);
    setEditPrompt(p.system_prompt);
  };

  const onSaveEdit = async () => {
    if (!editingProfile) return;
    try {
      await updateProfile(editingProfile.id, editName, editPrompt);
      flash(`Saved "${editName}".`);
      setEditingProfile(null);
      await reload();
    } catch (err) {
      console.error(err);
      flash("Save failed.");
    }
  };

  const onDeleteProfile = async (id: string) => {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    if (p.is_builtin) {
      flash("Builtin profiles can't be deleted.");
      return;
    }
    if (!confirm(`Delete profile "${p.name}"?`)) return;
    try {
      await deleteProfile(id);
      flash("Deleted.");
      await reload();
    } catch (err) {
      console.error(err);
      flash("Delete failed.");
    }
  };

  const onCreateProfile = async () => {
    if (!newName.trim() || !newPrompt.trim()) {
      flash("Name and prompt are required.");
      return;
    }
    try {
      const created = await createProfile(newName.trim(), newPrompt.trim());
      flash(`Created "${created.name}".`);
      setCreatingNew(false);
      setNewName("");
      setNewPrompt("");
      await reload();
    } catch (err) {
      console.error(err);
      flash("Create failed.");
    }
  };

  const onToggleGoogleSearch = async (next: boolean) => {
    // v0.1.0: store the toggle as a prefix on settings.model. Phase 4 will
    // add a dedicated `googleSearchEnabled` field to AppSettings.
    const base = settings?.model?.replace(/^search:/, "") ?? "gemini-2.5-flash";
    const model = next ? `search:${base}` : base;
    await applySettings({ model });
    flash(next ? "Google Search enabled." : "Google Search disabled.");
  };

  if (!settings) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  // Resolve the effective model + search state from settings.model
  const effectiveModel = settings.model.replace(/^search:/, "");
  const effectiveSearch = settings.model.startsWith("search:");

  return (
    <div className="h-full overflow-auto p-6 space-y-6 max-w-2xl mx-auto w-full">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI Customize</h1>
        <p className="text-sm text-zinc-400">
          {status || "Pick a profile, edit the prompt, and tune the model."}
        </p>
      </header>

      {/* Active profile */}
      <Section title="Active profile">
        <select
          value={activeId}
          onChange={(e) => onSelectProfile(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <optgroup label="Builtin">
            {ALL_PROFILE_IDS.map((id) => (
              <option key={id} value={id}>
                {PROFILE_LABELS[id]}
              </option>
            ))}
          </optgroup>
          {profiles.filter((p) => !p.is_builtin).length > 0 && (
            <optgroup label="Custom">
              {profiles
                .filter((p) => !p.is_builtin)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
          )}
        </select>
        <p className="text-[11px] text-zinc-500 mt-2">
          The active profile controls the system prompt sent with every chat.
        </p>
      </Section>

      {/* Edit / create */}
      <Section title="Profiles">
        <ul className="divide-y divide-zinc-800 -mx-1">
          {profiles.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between px-1 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="text-zinc-200 truncate">
                  {p.name}
                  {p.is_builtin && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-500">
                      builtin
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-500 truncate max-w-md">
                  {p.system_prompt.slice(0, 80)}…
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-3">
                <button
                  onClick={() => onEditProfile(p.id)}
                  className="px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors"
                >
                  Edit
                </button>
                {!p.is_builtin && (
                  <button
                    onClick={() => onDeleteProfile(p.id)}
                    className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <button
          onClick={() => setCreatingNew(true)}
          className="mt-3 w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-md px-3 py-2 text-sm font-medium transition-colors"
        >
          + Create new profile
        </button>
      </Section>

      {/* Model + tools */}
      <Section title="Model">
        <div className="grid grid-cols-2 gap-2">
          {MODEL_OPTIONS.map((m) => (
            <button
              key={m.value}
              onClick={() => applySettings({ model: effectiveSearch ? `search:${m.value}` : m.value })}
              className={cn(
                "rounded-md border px-3 py-2 text-sm text-left transition-colors",
                effectiveModel === m.value
                  ? "bg-blue-600/20 border-blue-500 text-blue-200"
                  : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500 mt-2">
          Hardcoded list; provider model registry not yet wired.
        </p>
      </Section>

      <Section title="Tools">
        <Toggle
          label="Google Search"
          description="Let the AI search the web for recent / factual answers."
          checked={effectiveSearch}
          onChange={onToggleGoogleSearch}
        />
        <p className="text-[11px] text-zinc-500 mt-2">
          Stored as a prefix on settings.model. A dedicated
          {` ${GOOGLE_SEARCH_KEY} `}
          setting is not yet wired.
        </p>
      </Section>

      {/* Edit modal */}
      {editingProfile && (
        <Modal onClose={() => setEditingProfile(null)} title={`Edit · ${editingProfile.name}`}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400">Name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1 w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400">System prompt</label>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                rows={16}
                className="mt-1 w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md px-2 py-1.5 text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingProfile(null)}
                className="px-3 py-1.5 rounded-md text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={onSaveEdit}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-md px-3 py-1.5 text-sm font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create modal */}
      {creatingNew && (
        <Modal onClose={() => setCreatingNew(false)} title="Create new profile">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400">Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Behavioral interview"
                className="mt-1 w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400">System prompt</label>
              <textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                rows={12}
                placeholder="You are an AI assistant that…"
                className="mt-1 w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md px-2 py-1.5 text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCreatingNew(false)}
                className="px-3 py-1.5 rounded-md text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={onCreateProfile}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-md px-3 py-1.5 text-sm font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Layout helpers                                                       */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2">
      <h2 className="text-sm font-medium text-zinc-200">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <div className="text-sm text-zinc-200">{label}</div>
        <div className="text-xs text-zinc-500 mt-0.5">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "w-9 h-5 rounded-full transition-colors relative shrink-0",
          checked ? "bg-blue-600" : "bg-zinc-700",
        )}
        aria-pressed={checked}
        title={checked ? "ON" : "OFF"}
      >
        <span
          className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-medium">{title}</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 text-sm"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
