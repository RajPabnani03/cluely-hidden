import { useRouter, type ViewId, VIEW_LABELS, ALL_VIEWS } from "../lib/router";
import { useOverlayStore } from "../lib/store";
import {
  MessageSquare,
  Home,
  Sparkles,
  Palette,
  Bot,
  History,
  HelpCircle,
  Eye,
  MousePointer2,
  X,
} from "lucide-react";
import { hideOverlay, setClickThrough as tauriSetClickThrough } from "../lib/tauri";
import { cn } from "../lib/utils";

/**
 * Left navigation strip. Renders 7 icon buttons — one per view — plus a
 * status footer (hotkey hint, version, click-through toggle, close).
 *
 * Width is fixed (~60px) so the rest of the window can be flex-1.
 * Match the existing overlay aesthetic: zinc-900 backdrop, zinc-800 borders,
 * rounded corners, blue-600 active state.
 */
export function Sidebar() {
  const currentView = useRouter((s) => s.currentView);
  const hasOnboarded = useRouter((s) => s.hasOnboarded);
  const setView = useRouter((s) => s.setView);

  const clickThrough = useOverlayStore((s) => s.clickThrough);
  const setClickThrough = useOverlayStore((s) => s.setClickThrough);
  const toggleBindings = useOverlayStore((s) => s.hotkeyBindings);

  // Find the toggle_visibility hotkey for the footer hint (e.g. "⌘+\\").
  const toggleBinding = toggleBindings.find(([action]) => action === "toggle_visibility");
  const toggleHint = toggleBinding ? toggleBinding[1] : "⌘+\\";

  // Hide the onboarding nav button once completed (still reachable via reset)
  const visibleViews: ViewId[] = hasOnboarded
    ? ALL_VIEWS.filter((v) => v !== "onboarding")
    : ALL_VIEWS;

  return (
    <aside className="w-[60px] shrink-0 h-full flex flex-col items-center justify-between bg-zinc-950/80 border-r border-zinc-800 py-3">
      {/* Top: nav icons */}
      <nav className="flex flex-col items-center gap-1 w-full px-2">
        {visibleViews.map((view) => (
          <NavButton
            key={view}
            view={view}
            active={currentView === view}
            onClick={() => setView(view)}
          />
        ))}
      </nav>

      {/* Bottom: status + window controls */}
      <div className="flex flex-col items-center gap-2 w-full px-2">
        <div className="w-full pt-2 border-t border-zinc-800 flex flex-col items-center gap-1.5">
          <button
            onClick={async () => {
              const next = !clickThrough;
              setClickThrough(next);
              try {
                await tauriSetClickThrough(next);
              } catch (err) {
                console.error("setClickThrough failed:", err);
              }
            }}
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-md transition-colors",
              clickThrough
                ? "bg-blue-600/20 text-blue-400"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
            )}
            title={
              clickThrough
                ? "Click-through ON — overlay ignores clicks"
                : "Click-through OFF — overlay captures clicks"
            }
          >
            {clickThrough ? (
              <Eye className="w-4 h-4" />
            ) : (
              <MousePointer2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => hideOverlay().catch(console.error)}
            className="w-9 h-9 flex items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            title={`Hide overlay (${toggleHint})`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-[9px] text-zinc-500 font-mono tracking-tight text-center leading-tight">
          v0.3.0
        </div>
      </div>
    </aside>
  );
}

interface NavButtonProps {
  view: ViewId;
  active: boolean;
  onClick: () => void;
}

function NavButton({ view, active, onClick }: NavButtonProps) {
  const Icon = NAV_ICONS[view];
  return (
    <button
      onClick={onClick}
      title={VIEW_LABELS[view]}
      aria-label={VIEW_LABELS[view]}
      aria-current={active ? "page" : undefined}
      className={cn(
        "w-10 h-10 flex items-center justify-center rounded-md transition-colors",
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
      )}
    >
      <Icon className="w-[18px] h-[18px]" />
    </button>
  );
}

const NAV_ICONS: Record<ViewId, React.ComponentType<{ className?: string }>> = {
  assistant: MessageSquare,
  main: Home,
  onboarding: Sparkles,
  customize: Palette,
  "ai-customize": Bot,
  history: History,
  help: HelpCircle,
};
