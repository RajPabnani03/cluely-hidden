/**
 * Display formatting for hotkey bindings.
 *
 * Bindings are stored as Tauri-style combos ("CmdOrCtrl+Shift+Backslash").
 * These helpers turn each part into a compact symbol for keycap UI.
 */

const KEY_SYMBOLS: Record<string, string> = {
  cmdorctrl: "⌘",
  cmd: "⌘",
  ctrl: "⌃",
  control: "⌃",
  shift: "⇧",
  alt: "⌥",
  option: "⌥",
  meta: "⌘",
  enter: "↵",
  return: "↵",
  backslash: "\\",
  bracketleft: "[",
  bracketright: "]",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  space: "␣",
  escape: "⎋",
  tab: "⇥",
  backspace: "⌫",
  delete: "⌦",
};

/** "CmdOrCtrl+Shift+Backslash" → ["⌘", "⇧", "\\"] */
export function keyParts(binding: string): string[] {
  return binding
    .split("+")
    .filter((p) => p.length > 0)
    .map((p) => KEY_SYMBOLS[p.toLowerCase()] ?? p);
}

/** "CmdOrCtrl+Shift+Backslash" → "⌘⇧\\" */
export function formatHotkey(binding: string): string {
  return keyParts(binding).join("");
}
