/**
 * OnboardingView — 4-step first-run wizard.
 *
 *   1. Welcome        — what the app is
 *   2. Privacy        — what makes it invisible + emergency erase hint
 *   3. Hotkeys        — the 11 hotkeys and their current bindings
 *   4. Profile        — pick a starting profile, finish
 *
 * On the final step "Get Started" calls `setOnboarded()` so the App-level
 * gate stops redirecting back here on the next launch.
 *
 * Phase 4 will: persist `hasOnboarded` to localStorage and to the DB.
 */

import { useState } from "react";
import { useRouter } from "../../lib/router";
import { useOverlayStore } from "../../lib/store";
import { ALL_PROFILE_IDS, PROFILE_LABELS, type ProfileId } from "../../lib/profiles";
import { cn } from "../../lib/utils";

const STEP_COUNT = 4;

export function OnboardingView() {
  const setOnboarded = useRouter((s) => s.setOnboarded);
  const setView = useRouter((s) => s.setView);
  const hotkeyBindings = useOverlayStore((s) => s.hotkeyBindings);
  const [step, setStep] = useState(0);
  const [pickedProfile, setPickedProfile] = useState<ProfileId>("interview");

  const next = () => setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = () => {
    setOnboarded();
    setView("assistant");
  };

  return (
    <div className="h-full flex flex-col p-6 max-w-xl mx-auto w-full">
      {/* Progress bar */}
      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span>
            Step {step + 1} of {STEP_COUNT}
          </span>
          <button
            onClick={finish}
            className="hover:text-zinc-300 transition-colors"
          >
            Skip
          </button>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${((step + 1) / STEP_COUNT) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-auto">
        {step === 0 && <StepWelcome />}
        {step === 1 && <StepPrivacy />}
        {step === 2 && <StepHotkeys bindings={hotkeyBindings} />}
        {step === 3 && (
          <StepProfile
            pickedProfile={pickedProfile}
            setPickedProfile={setPickedProfile}
          />
        )}
      </div>

      {/* Nav buttons */}
      <div className="pt-6 flex items-center justify-between border-t border-zinc-800">
        <button
          onClick={back}
          disabled={step === 0}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm transition-colors",
            step === 0
              ? "text-zinc-600 cursor-not-allowed"
              : "text-zinc-300 hover:bg-zinc-800",
          )}
        >
          ← Back
        </button>
        {step < STEP_COUNT - 1 ? (
          <button
            onClick={next}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={finish}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
          >
            Get Started →
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Steps                                                                */
/* ------------------------------------------------------------------ */

function StepWelcome() {
  return (
    <div className="space-y-4">
      <div className="text-5xl">👋</div>
      <h2 className="text-2xl font-semibold tracking-tight">
        Welcome to Cluely Hidden
      </h2>
      <p className="text-sm text-zinc-400 leading-relaxed">
        The AI assistant that doesn't show up on screen-share.
        Designed for interviews, sales calls, meetings, and presentations
        where you need a co-pilot — but not a visible one.
      </p>
      <ul className="text-sm text-zinc-300 space-y-2 pl-2">
        <li>✓ Lives in a transparent overlay, never recorded</li>
        <li>✓ ⌘+\\ to toggle from anywhere</li>
        <li>✓ Emergency erase wipes everything in one keystroke</li>
      </ul>
    </div>
  );
}

function StepPrivacy() {
  return (
    <div className="space-y-4">
      <div className="text-5xl">🕶️</div>
      <h2 className="text-2xl font-semibold tracking-tight">
        Invisible by design
      </h2>
      <p className="text-sm text-zinc-400 leading-relaxed">
        Completely invisible in Zoom, Meet, and Teams — the overlay window
        is content-protected and hidden from the Dock. Your screen-share
        audience never sees it.
      </p>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
        <div className="text-sm font-medium text-amber-300">
          Emergency erase: <kbd className="font-mono text-xs">⌘+Shift+E</kbd>
        </div>
        <p className="text-xs text-amber-200/80">
          Hides the overlay, kills the AI session, and clears all in-memory
          state. Use it when someone walks up to your screen.
        </p>
      </div>
    </div>
  );
}

interface StepHotkeysProps {
  bindings: Array<[string, string]>;
}

const HOTKEY_DESCRIPTIONS: Record<string, string> = {
  toggle_visibility: "Toggle overlay",
  next_step: "Take screenshot / start session",
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
};

const HOTKEY_ORDER = [
  "toggle_visibility",
  "next_step",
  "emergency_erase",
  "toggle_click_through",
  "move_up",
  "move_down",
  "move_left",
  "move_right",
  "previous_response",
  "next_response",
  "scroll_up",
  "scroll_down",
];

function StepHotkeys({ bindings }: StepHotkeysProps) {
  // Build a lookup of action → current binding (default if missing)
  const map: Record<string, string> = {};
  for (const [action, key] of bindings) {
    map[action] = key;
  }

  return (
    <div className="space-y-4">
      <div className="text-5xl">⌨️</div>
      <h2 className="text-2xl font-semibold tracking-tight">Hotkeys</h2>
      <p className="text-sm text-zinc-400">
        The 11 hotkeys at your fingertips. Rebind them later in Customize.
      </p>
      <ul className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
        {HOTKEY_ORDER.map((action) => (
          <li
            key={action}
            className="flex items-center justify-between px-3 py-2 text-sm"
          >
            <span className="text-zinc-300">
              {HOTKEY_DESCRIPTIONS[action] ?? action}
            </span>
            <kbd className="font-mono text-xs bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded text-zinc-200">
              {map[action] ?? "—"}
            </kbd>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface StepProfileProps {
  pickedProfile: ProfileId;
  setPickedProfile: (p: ProfileId) => void;
}

function StepProfile({ pickedProfile, setPickedProfile }: StepProfileProps) {
  return (
    <div className="space-y-4">
      <div className="text-5xl">🎯</div>
      <h2 className="text-2xl font-semibold tracking-tight">
        Pick a starting profile
      </h2>
      <p className="text-sm text-zinc-400">
        You can change this any time — and edit the system prompt in
        AI Customize.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {ALL_PROFILE_IDS.map((id) => (
          <button
            key={id}
            onClick={() => setPickedProfile(id)}
            className={cn(
              "rounded-md border px-3 py-2.5 text-sm text-left transition-colors",
              pickedProfile === id
                ? "bg-blue-600/20 border-blue-500 text-blue-200"
                : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800",
            )}
          >
            {PROFILE_LABELS[id]}
          </button>
        ))}
      </div>
    </div>
  );
}
