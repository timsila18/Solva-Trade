import { AsyncLocalStorage } from "node:async_hooks";

const requestValues = new AsyncLocalStorage<Map<string, Promise<unknown>>>();

export function withRequestMemo<T>(run: () => Promise<T>): Promise<T> {
  return requestValues.run(new Map(), run);
}

export function memoInRequest<T>(key: string, load: () => Promise<T>): Promise<T> {
  const values = requestValues.getStore();
  if (!values) return load();
  if (!values.has(key)) values.set(key, Promise.resolve().then(load));
  return values.get(key) as Promise<T>;
}
