/**
 * Compact Context API client — DCP-inspired model-driven compaction.
 */

import { PHAOS_BASE } from './config';

export const compactApi = {
  getTokenCount: async (conversationId: string, modelName = 'default') => {
    const res = await fetch(`${PHAOS_BASE}/api/compact/conversation/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, model_name: modelName }),
    });
    if (!res.ok) throw new Error(`Failed to get tokens: ${res.statusText}`);
    return res.json();
  },

  compactConversation: async (conversationId: string, start: number, end: number, summary: string, modelName = 'default') => {
    const res = await fetch(`${PHAOS_BASE}/api/compact/conversation/compact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, start, end, summary, model_name: modelName }),
    });
    if (!res.ok) throw new Error(`Failed to compact: ${res.statusText}`);
    return res.json();
  },

  forceCompact: async (conversationId: string, modelName = 'default') => {
    const res = await fetch(`${PHAOS_BASE}/api/compact/conversation/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, model_name: modelName }),
    });
    if (!res.ok) throw new Error(`Failed to get tokens: ${res.statusText}`);
    const usage = await res.json();
    if (usage.total > 0) {
      const compactRes = await fetch(`${PHAOS_BASE}/api/compact/conversation/compact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          start: 0,
          end: Math.floor(usage.total / (usage.max * 0.01)),
          summary: 'Context compacted by user request.',
          model_name: modelName,
        }),
      });
      if (!compactRes.ok) throw new Error(`Failed to compact: ${compactRes.statusText}`);
      return compactRes.json();
    }
    return { success: true, original_count: 0, compacted_count: 0 };
  },

  discardMessages: async (conversationId: string, messageIds: number[], modelName = 'default') => {
    const res = await fetch(`${PHAOS_BASE}/api/compact/conversation/discard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, message_ids: messageIds, model_name: modelName }),
    });
    if (!res.ok) throw new Error(`Failed to discard: ${res.statusText}`);
    return res.json();
  },

  protectMessages: async (conversationId: string, messageIds: number[], modelName = 'default') => {
    const res = await fetch(`${PHAOS_BASE}/api/compact/conversation/protect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, message_ids: messageIds, model_name: modelName }),
    });
    if (!res.ok) throw new Error(`Failed to protect: ${res.statusText}`);
    return res.json();
  },

  pruneToolCalls: async (conversationId: string, toolCallIds: string[], modelName = 'default') => {
    const res = await fetch(`${PHAOS_BASE}/api/compact/conversation/prune`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, tool_call_ids: toolCallIds, model_name: modelName }),
    });
    if (!res.ok) throw new Error(`Failed to prune: ${res.statusText}`);
    return res.json();
  },

  getTools: async () => {
    const res = await fetch(`${PHAOS_BASE}/api/compact/tools`);
    if (!res.ok) throw new Error(`Failed to get tools: ${res.statusText}`);
    return res.json();
  },
};
