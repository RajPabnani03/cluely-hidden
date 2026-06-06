import { useEffect, useState } from "react";
import { getSettings, updateSettings, type AppSettings } from "../lib/tauri";
import { Eye, Mic, Camera, Sun, Moon, Monitor, Cpu } from "lucide-react";
import { cn } from "../lib/utils";

export function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
  }, []);

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  const update = async (patch: Partial<AppSettings>) => {
    setSaving(true);
    setSaved(false);
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      const updated = await updateSettings(next);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {saving && "Saving…"}
          {saved && <span className="text-primary">✓ Saved</span>}
          {!saving && !saved && "All changes are saved automatically."}
        </p>
      </header>

      <Section title="Appearance">
        <Row label="Theme" description="Light, dark, or follow your system.">
          <SegmentedControl
            value={settings.theme}
            options={[
              { value: "light", label: "Light", icon: <Sun className="w-3.5 h-3.5" /> },
              { value: "dark", label: "Dark", icon: <Moon className="w-3.5 h-3.5" /> },
              { value: "system", label: "System", icon: <Monitor className="w-3.5 h-3.5" /> },
            ]}
            onChange={(v) => update({ theme: v })}
          />
        </Row>
      </Section>

      <Section title="Hotkey">
        <Row label="Toggle overlay" description="Press to show/hide from anywhere.">
          <code className="px-2 py-1 rounded bg-muted text-xs font-mono">
            {settings.hotkey}
          </code>
        </Row>
      </Section>

      <Section title="AI Model" hint="Available in v0.2 — Ollama integration">
        <Row label="Model" description="Local model to use for responses.">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-muted-foreground" />
            <select
              value={settings.model}
              onChange={(e) => update({ model: e.target.value })}
              className="bg-muted border border-white/5 rounded-md px-2 py-1 text-sm"
            >
              <option value="llama3.2:3b">llama3.2:3b (fast)</option>
              <option value="llama3.1:8b">llama3.1:8b (smarter)</option>
              <option value="qwen2.5:7b">qwen2.5:7b</option>
            </select>
          </div>
        </Row>
      </Section>

      <Section title="Capture" hint="v0.3 — opt-in only, all stored locally">
        <Toggle
          icon={<Camera className="w-4 h-4" />}
          label="Screen capture"
          description="Allow ⌘+Shift+S to capture the current screen."
          checked={settings.captureEnabled}
          onChange={(v) => update({ captureEnabled: v })}
        />
        <Toggle
          icon={<Mic className="w-4 h-4" />}
          label="Audio capture"
          description="Allow ⌘+Shift+A to record microphone and transcribe."
          checked={settings.audioEnabled}
          onChange={(v) => update({ audioEnabled: v })}
        />
      </Section>

      <Section title="System">
        <Toggle
          icon={<Eye className="w-4 h-4" />}
          label="Launch at login"
          description="Start Cluely Hidden when you log in."
          checked={settings.launchAtLogin}
          onChange={(v) => update({ launchAtLogin: v })}
        />
      </Section>

      <footer className="mt-12 pt-6 border-t border-white/5 text-xs text-muted-foreground">
        Cluely Hidden v0.1.0 · <a className="hover:text-foreground" href="#">View on GitHub</a>
      </footer>
    </div>
  );
}

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground/60">{hint}</span>}
      </div>
      <div className="space-y-1 rounded-lg border border-white/5 bg-card/40 divide-y divide-white/5">
        {children}
      </div>
    </section>
  );
}

function Row({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ icon, label, description, checked, onChange }: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row label={label} description={description}>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">{icon}</span>
        <button
          onClick={() => onChange(!checked)}
          className={cn(
            "w-9 h-5 rounded-full transition-colors relative",
            checked ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
              checked ? "translate-x-4" : "translate-x-0.5",
            )}
          />
        </button>
      </div>
    </Row>
  );
}

function SegmentedControl({ value, options, onChange }: {
  value: string;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-md border border-white/5 bg-muted/50 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors",
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
