import { load } from "@tauri-apps/plugin-store";

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

let storePromise: Promise<Awaited<ReturnType<typeof load>>> | null = null;

async function getStore() {
  if (!storePromise) {
    storePromise = load("opencomputer.json", { autoSave: true, defaults: {} });
  }
  return storePromise;
}

/**
 * Local persistence. Uses Tauri's secure store plugin inside the native
 * shell (data lives in the OS app-config dir, never in committed files).
 * Falls back to localStorage when running in a plain browser (vite dev).
 */
export async function getValue<T>(key: string): Promise<T | null> {
  if (isTauri()) {
    try {
      const store = await getStore();
      return (store.get(key) as T | null) ?? null;
    } catch {
      // fall through to localStorage
    }
  }
  const raw = localStorage.getItem(`oc:${key}`);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function setValue<T>(key: string, value: T): Promise<void> {
  if (isTauri()) {
    try {
      const store = await getStore();
      await store.set(key, value);
      await store.save();
      return;
    } catch {
      // fall through to localStorage
    }
  }
  localStorage.setItem(`oc:${key}`, JSON.stringify(value));
}
