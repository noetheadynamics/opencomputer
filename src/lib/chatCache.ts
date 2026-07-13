/**
 * In-session cache of chat messages, keyed by conversation id.
 *
 * ChatView is unmounted whenever the user navigates to another panel
 * (see App.tsx conditional rendering). On remount it would otherwise
 * re-fetch messages from the backend, causing a visible "refresh".
 *
 * This module-level cache lets ChatView restore instantly from memory
 * and skip the network round-trip. It lives for the lifetime of the page
 * session (cleared on full reload).
 */

import type { UIMessage } from "@/components/ChatView";

const cache = new Map<string, UIMessage[]>();

export const chatCache = {
  get(convId: string): UIMessage[] | undefined {
    return cache.get(convId);
  },
  set(convId: string, messages: UIMessage[]): void {
    cache.set(convId, messages);
  },
  has(convId: string): boolean {
    return cache.has(convId);
  },
  delete(convId: string): void {
    cache.delete(convId);
  },
  clear(): void {
    cache.clear();
  },
};
