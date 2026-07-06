import type { DbMessage } from "../lib/db-types";
import { formatRelativeTime } from "../lib/utils";

/** Chronological message timeline for a session (Sprint D). */
export function SessionTimeline({ messages }: { messages: DbMessage[] }) {
  if (messages.length === 0) {
    return (
      <p className="text-xs text-zinc-500 py-4 text-center">No messages in this session.</p>
    );
  }
  const sorted = [...messages].sort((a, b) => a.created_at - b.created_at);
  return (
    <ol className="space-y-2 max-h-48 overflow-auto pr-1">
      {sorted.map((m) => (
        <li
          key={m.id}
          className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-2.5 py-2"
        >
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {m.role}
            </span>
            <time className="text-[10px] text-zinc-600 tabular-nums">
              {formatRelativeTime(m.created_at)}
            </time>
          </div>
          <p className="text-[11px] text-zinc-300 whitespace-pre-wrap break-words line-clamp-4">
            {m.content}
          </p>
        </li>
      ))}
    </ol>
  );
}