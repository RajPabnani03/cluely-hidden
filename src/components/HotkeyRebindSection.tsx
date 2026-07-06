import { useCallback, useEffect, useState } from "react";
import {
  getHotkeyBindings,
  rebindHotkey,
  type HotkeyActionId,
  type HotkeyBindings,
} from "../lib/tauri";

const ACTION_LABELS: Record<HotkeyActionId, string> = {
  toggle_visibility: "Show / hide overlay",
  next_step: "Next step (start live / capture)",
  emergency_erase: "Emergency erase",
  toggle_click_through: "Toggle click-through",
  move_up: "Move overlay up",
  move_down: "Move overlay down",
  move_left: "Move overlay left",
  move_right: "Move overlay right",
  previous_response: "Previous response",
  next_response: "Next response",
  scroll_up: "Scroll up",
  scroll_down: "Scroll down",
  cycle_stealth_tier: "Cycle stealth tier",
};

function formatKeyCombo(combo: string): string {
  return combo
    .replace(/CmdOrCtrl/g, "⌘")
    .replace(/Shift/g, "⇧")
    .replace(/Alt/g, "⌥")
    .replace(/BracketLeft/g, "[")
    .replace(/BracketRight/g, "]")
    .replace(/Backslash/g, "\\")
    .replace(/Enter/g, "↵")
    .replace(/ArrowUp/g, "↑")
    .replace(/ArrowDown/g, "↓")
    .replace(/ArrowLeft/g, "←")
    .replace(/ArrowRight/g, "→");
}

interface HotkeyRebindSectionProps {
  onStatus: (msg: string) => void;
}

export function HotkeyRebindSection({ onStatus }: HotkeyRebindSectionProps) {
  const [bindings, setBindings] = useState<HotkeyBindings>([]);
  const [editing, setEditing] = useState<HotkeyActionId | null>(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    try {
      const b = await getHotkeyBindings();
      setBindings(b);
    } catch (err) {
      console.error(err);
      onStatus("Failed to load hotkeys");
    }
  }, [onStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (action: HotkeyActionId, current: string) => {
    setEditing(action);
    setDraft(current);
  };

  const save = async () => {
    if (!editing || !draft.trim()) return;
    try {
      await rebindHotkey(editing, draft.trim());
      await load();
      onStatus("Hotkey saved");
      setEditing(null);
    } catch (err) {
      console.error(err);
      onStatus("Rebind failed — check combo format");
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-zinc-500">
        Use Tauri format, e.g.{" "}
        <code className="text-zinc-400">CmdOrCtrl+Shift+Enter</code>
      </p>
      <ul className="space-y-1.5 max-h-[280px] overflow-auto pr-1">
        {bindings.map(([action, key]) => (
          <li
            key={action}
            className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5 py-2"
          >
            <span className="text-[11px] text-zinc-300 flex-1 min-w-0 truncate">
              {ACTION_LABELS[action] ?? action}
            </span>
            {editing === action ? (
              <input
                className="w-36 font-mono text-[10px] bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => void save()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save();
                  if (e.key === "Escape") setEditing(null);
                }}
                autoFocus
              />
            ) : (
              <button
                type="button"
                onClick={() => startEdit(action, key)}
                className="font-mono text-[10px] bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-zinc-200 hover:border-blue-500/50"
              >
                {formatKeyCombo(key)}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}