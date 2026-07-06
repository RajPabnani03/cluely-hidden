/**
 * SettingsView — secondary overlay sheet for app configuration.
 *
 * Consolidates what used to be Customize + AICustomize into a single
 * clean panel that slides over the Assistant card.
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "../../lib/router";
import { cn } from "../../lib/utils";
import {
  type AppSettings,
  getSettings,
  updateSettings,
  listProfiles,
  type DbProfile,
  updateProfile,
  createProfile,
  deleteProfile,
} from "../../lib/tauri";

const MODEL_OPTIONS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (fast)" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (smarter)" },
];

export function SettingsView() {
  const back = useRouter((s) => s.backToAssistant);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [profiles, setProfiles] = useState<DbProfile[]>([]);
  const [activeTab, setActiveTab] = useState<"general" | "profiles" | "model">("general");
  const [status, setStatus] = useState("");
  const [geminiKeyDraft, setGeminiKeyDraft] = useState("");

  useEffect(() => {
    Promise.all([getSettings(), listProfiles()])
      .then(([s, p]) => {
        setSettings(s);
        setProfiles(p);
        setGeminiKeyDraft("");
      })
      .catch(console.error);
  }, []);

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(""), 1800);
  };

  const applySettings = async (patch: import("../../lib/tauri").SettingsUpdatePatch) => {
    if (!settings) return;
    try {
      const updated = await updateSettings(patch);
      setSettings(updated);
      if (!("geminiApiKey" in patch)) {
        flash("Saved");
      } else {
        setGeminiKeyDraft("");
        flash("API key saved");
      }
    } catch (err) {
      console.error(err);
      flash("Save failed");
    }
  };

  const effectiveModel = settings?.model?.replace(/^search:/, "") ?? "gemini-2.5-flash";
  const effectiveSearch = settings?.model?.startsWith("search:") ?? false;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div
        className={cn(
          "w-full max-w-[420px] max-h-[85vh] flex flex-col rounded-[20px] overflow-hidden",
          "bg-zinc-900/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl"
        )}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
          <button
            onClick={back}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex border-b border-white/[0.06]">
          {(["general", "profiles", "model"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2 text-xs font-medium transition-colors",
                activeTab === tab
                  ? "text-zinc-100 border-b-2 border-blue-500"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {status && (
            <div className="text-[11px] text-zinc-400">{status}</div>
          )}

          {activeTab === "general" && settings && (
            <>
              <Section title="Theme">
                <SegmentedControl
                  value={settings.theme}
                  options={["dark", "light", "system"].map((t) => ({
                    value: t,
                    label: t[0].toUpperCase() + t.slice(1),
                  }))}
                  onChange={(v) => applySettings({ theme: v as AppSettings["theme"] })}
                />
              </Section>
              <Section title="Overlay">
                <Row label={`Panel opacity (${Math.round((settings.overlayOpacity ?? 0.92) * 100)}%)`}>
                  <input
                    type="range"
                    min={40}
                    max={100}
                    value={Math.round((settings.overlayOpacity ?? 0.92) * 100)}
                    onChange={(e) => {
                      const v = Number(e.target.value) / 100;
                      setSettings({ ...settings, overlayOpacity: v });
                    }}
                    onMouseUp={() =>
                      applySettings({ overlayOpacity: settings.overlayOpacity })
                    }
                    onTouchEnd={() =>
                      applySettings({ overlayOpacity: settings.overlayOpacity })
                    }
                    className="w-full accent-blue-500"
                  />
                </Row>
              </Section>
              <Section title="Toggle hotkey">
                <Row label="Show / hide overlay">
                  <kbd className="font-mono text-xs bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-zinc-200">
                    {settings.hotkey}
                  </kbd>
                </Row>
              </Section>
            </>
          )}

          {activeTab === "profiles" && settings && (
            <ProfileSection
              profiles={profiles}
              activeProfileId={settings.activeProfileId ?? null}
              onSetActive={(id) => applySettings({ activeProfileId: id })}
              onChange={setProfiles}
              onStatus={flash}
            />
          )}

          {activeTab === "model" && settings && (
            <>
              <Section title="Gemini API key">
                <p className="text-[11px] text-zinc-500 mb-2">
                  Required for Live sessions. Create a key at{" "}
                  <span className="text-zinc-400">aistudio.google.com</span>.
                </p>
                <input
                  type="password"
                  autoComplete="off"
                  value={geminiKeyDraft}
                  onChange={(e) => setGeminiKeyDraft(e.target.value)}
                  onBlur={() => {
                    if (geminiKeyDraft.trim()) {
                      applySettings({ geminiApiKey: geminiKeyDraft.trim() });
                    }
                  }}
                  placeholder={
                    settings.geminiApiKeyConfigured
                      ? "••••••••  (enter new key to replace)"
                      : "AIza…"
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </Section>
              <Section title="Model">
                <div className="grid grid-cols-1 gap-2">
                  {MODEL_OPTIONS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => applySettings({ model: effectiveSearch ? `search:${m.value}` : m.value })}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-sm text-left transition-colors",
                        effectiveModel === m.value
                          ? "bg-blue-600/20 border-blue-500 text-blue-200"
                          : "bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </Section>
              <Section title="Tools">
                <Toggle
                  label="Google Search"
                  description="Let the AI search the web for recent answers."
                  checked={effectiveSearch}
                  onChange={(next) => {
                    const base = settings.model?.replace(/^search:/, "") ?? "gemini-2.5-flash";
                    applySettings({ model: next ? `search:${base}` : base });
                  }}
                />
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileSection({
  profiles,
  activeProfileId,
  onSetActive,
  onChange,
  onStatus,
}: {
  profiles: DbProfile[];
  activeProfileId: string | null;
  onSetActive: (id: string) => void;
  onChange: (p: DbProfile[]) => void;
  onStatus: (s: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");

  const reload = async () => {
    const p = await listProfiles();
    onChange(p);
  };

  const onCreate = async () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    await createProfile(newName.trim(), newPrompt.trim());
    setCreating(false);
    setNewName("");
    setNewPrompt("");
    await reload();
    onStatus("Profile created");
  };

  const onUpdate = async (id: string, name: string, prompt: string) => {
    await updateProfile(id, name, prompt);
    await reload();
    onStatus("Profile updated");
  };

  const onDelete = async (id: string) => {
    const p = profiles.find((x) => x.id === id);
    if (!p || p.is_builtin) return;
    if (!confirm(`Delete "${p.name}"?`)) return;
    await deleteProfile(id);
    await reload();
    onStatus("Profile deleted");
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {profiles.map((p) => (
          <li
            key={p.id}
            className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-zinc-200">
                {p.name}
                {p.is_builtin && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-500">builtin</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onSetActive(p.id)}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-md border transition-colors",
                  activeProfileId === p.id
                    ? "border-blue-500/60 bg-blue-600/20 text-blue-200"
                    : "border-zinc-700 text-zinc-500 hover:text-zinc-300",
                )}
              >
                {activeProfileId === p.id ? "Live default" : "Use for live"}
              </button>
            </div>
            <textarea
              defaultValue={p.system_prompt}
              rows={4}
              className="mt-2 w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1.5 text-[11px] text-zinc-300 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
              onBlur={(e) => onUpdate(p.id, p.name, e.target.value)}
            />
            {!p.is_builtin && (
              <button
                onClick={() => onDelete(p.id)}
                className="mt-2 text-[11px] text-red-400 hover:text-red-300"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>

      {creating ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3 space-y-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Profile name"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <textarea
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            placeholder="System prompt…"
            rows={4}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1.5 text-[11px] text-zinc-300 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setCreating(false)}
              className="px-3 py-1.5 rounded-md text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={onCreate}
              className="px-3 py-1.5 rounded-md text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              Create
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full py-2 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 transition-colors"
        >
          + Create profile
        </button>
      )}
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-zinc-300">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-lg border border-zinc-700/60 bg-zinc-950 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            value === o.value ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
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
        <div className="text-sm text-zinc-300">{label}</div>
        <div className="text-[11px] text-zinc-500 mt-0.5">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "w-9 h-5 rounded-full transition-colors relative shrink-0",
          checked ? "bg-blue-600" : "bg-zinc-700"
        )}
        aria-pressed={checked}
      >
        <span
          className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
