/**
 * CustomizeView — appearance settings.
 *
 * For v0.1.0 the controls are wired to `updateSettings` (theme, model, etc.)
 * and to the in-memory `hotkeyBindings` store. Background-transparency
 * doesn't yet have a DB field, so it's local-only (UI preview only).
 *
 * Phase 4 will add a real transparency setting in Rust and a font-size
 * scaling CSS variable on the root.
 */

import { useEffect, useState } from "react";
import { type AppSettings, getSettings, updateSettings } from "../../lib/tauri";
import { cn } from "../../lib/utils";

const THEMES = ["dark", "light", "system"] as const;
const FONT_SIZES = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
] as const;
const TRANSPARENCY = [
  { id: "0", label: "0%" },
  { id: "25", label: "25%" },
  { id: "50", label: "50%" },
  { id: "75", label: "75%" },
] as const;

export function CustomizeView() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const [transparency, setTransparency] = useState<string>("25");
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
  }, []);

  const apply = async (patch: Partial<AppSettings>) => {
    if (!settings) return;
    setSaving(true);
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      const updated = await updateSettings(next);
      setSettings(updated);
      setSavedTick((n) => n + 1);
    } catch (err) {
      console.error("updateSettings failed:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-6 max-w-2xl mx-auto w-full">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Customize</h1>
        <p className="text-sm text-zinc-400">
          {saving
            ? "Saving…"
            : savedTick > 0
              ? "✓ Saved"
              : "All changes are saved automatically."}
        </p>
      </header>

      <Section title="Theme">
        <SegmentedControl
          value={settings.theme}
          options={THEMES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))}
          onChange={(v) => apply({ theme: v as AppSettings["theme"] })}
        />
        <p className="text-[11px] text-zinc-500 mt-2">
          For now only the dark theme is fully styled. Light/system themes are
          not yet wired.
        </p>
      </Section>

      <Section title="Font size">
        <SegmentedControl
          value={fontSize}
          options={FONT_SIZES.map((f) => ({ value: f.id, label: f.label }))}
          onChange={(v) => setFontSize(v as "small" | "medium" | "large")}
        />
        <p className="text-[11px] text-zinc-500 mt-2">
          UI scaling is preview-only; persistence not yet wired.
        </p>
      </Section>

      <Section title="Background transparency">
        <div className="grid grid-cols-4 gap-2">
          {TRANSPARENCY.map((t) => (
            <button
              key={t.id}
              onClick={() => setTransparency(t.id)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm transition-colors",
                transparency === t.id
                  ? "bg-blue-600/20 border-blue-500 text-blue-200"
                  : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500 mt-2">
          Visual preview only. Real overlay alpha must be set on the Rust
          window at runtime — not yet exposed.
        </p>
      </Section>

      <Section title="Toggle hotkey">
        <Row label="Show / hide overlay" description="Global hotkey to toggle the window.">
          <kbd className="font-mono text-xs bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-zinc-200">
            {settings.hotkey}
          </kbd>
        </Row>
        <p className="text-[11px] text-zinc-500 mt-2">
          To rebind, edit src-tauri/tauri.conf.json and restart the app.
          In-app rebinding is not yet wired.
        </p>
      </Section>
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

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <div className="text-sm text-zinc-200">{label}</div>
        <div className="text-xs text-zinc-500 mt-0.5">{description}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface SegmentedProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

function SegmentedControl({ value, options, onChange }: SegmentedProps) {
  return (
    <div className="flex rounded-md border border-zinc-800 bg-zinc-950 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors",
            value === o.value
              ? "bg-zinc-800 text-zinc-100 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
