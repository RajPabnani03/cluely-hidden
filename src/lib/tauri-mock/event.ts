/**
 * Browser stand-in for `@tauri-apps/api/event`.
 * Loaded via vite alias only when running `npm run dev:browser`.
 */
import { addListener, emitLocal } from "./bus";

export type UnlistenFn = () => void;

export interface Event<T> {
  event: string;
  payload: T;
}

export function listen<T>(
  event: string,
  handler: (event: Event<T>) => void,
): Promise<UnlistenFn> {
  const unlisten = addListener(event, (payload) =>
    handler({ event, payload } as Event<T>),
  );
  return Promise.resolve(unlisten);
}

export async function emit(event: string, payload?: unknown): Promise<void> {
  emitLocal(event, payload);
}

export function once<T>(
  event: string,
  handler: (event: Event<T>) => void,
): Promise<UnlistenFn> {
  let inner: UnlistenFn | undefined;
  const wrapped = (payload: unknown) => {
    handler({ event, payload } as Event<T>);
    inner?.();
  };
  inner = addListener(event, wrapped);
  return Promise.resolve(() => inner?.());
}
