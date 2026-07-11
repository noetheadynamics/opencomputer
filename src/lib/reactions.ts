/**
 * Reaction utilities.
 */

import type { ChatReaction } from '../types/chat';

export function addReaction(reactions: ChatReaction[], emoji: string, userId = 'user'): ChatReaction[] {
  const cloned = structuredClone(reactions);
  const existing = cloned.find((r) => r.emoji === emoji);
  if (existing) {
    if (!existing.users.includes(userId)) {
      existing.users.push(userId);
      existing.count = existing.users.length;
    }
    return cloned;
  }
  return [...cloned, { emoji, count: 1, users: [userId] }];
}

export function removeReaction(reactions: ChatReaction[], emoji: string, userId = 'user'): ChatReaction[] {
  const cloned = structuredClone(reactions);
  const idx = cloned.findIndex((r) => r.emoji === emoji);
  if (idx === -1) return cloned;
  const reaction = cloned[idx];
  reaction.users = reaction.users.filter((u) => u !== userId);
  if (reaction.users.length === 0) {
    return cloned.filter((_, i) => i !== idx);
  }
  reaction.count = reaction.users.length;
  return cloned;
}

export function toggleReaction(reactions: ChatReaction[], emoji: string, userId = 'user'): ChatReaction[] {
  const existing = reactions.find((r) => r.emoji === emoji);
  if (existing && existing.users.includes(userId)) {
    return removeReaction(reactions, emoji, userId);
  }
  return addReaction(reactions, emoji, userId);
}
