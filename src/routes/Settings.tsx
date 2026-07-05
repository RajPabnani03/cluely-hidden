/**
 * Standalone settings window — deprecated.
 *
 * Settings have moved into the main overlay as a sheet. This page remains
 * only because the Rust settings window still points to settings.html.
 */
export function Settings() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-6 text-center">
      <div className="max-w-sm space-y-3">
        <h1 className="text-lg font-semibold">Settings moved</h1>
        <p className="text-sm text-zinc-400">
          Open the Cluely overlay and click the ··· menu in the assistant card.
        </p>
      </div>
    </div>
  );
}
