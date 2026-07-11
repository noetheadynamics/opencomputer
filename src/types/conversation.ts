/**
 * Conversation types for OpenComputer.
 */

export interface Conversation {
  id: string;
  title: string;
  provider_label?: string;
  model_name?: string;
  harness_id: string;
  created_at: string;
  updated_at: string;
  preview?: string;
  messages?: Message[];
  system_prompt?: string;
  is_archived: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface ConversationListResponse {
  conversations: Conversation[];
}

export interface ConversationCreateRequest {
  title?: string;
  provider_label?: string;
  model_name?: string;
  harness_id?: string;
  system_prompt?: string;
}

export interface ConversationUpdateRequest {
  title?: string;
  provider_label?: string;
  model_name?: string;
  harness_id?: string;
  system_prompt?: string;
  is_archived?: number;
}

export interface MessageCreateRequest {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface MessageUpdateRequest {
  content: string;
}

export const DEFAULT_SYSTEM_PROMPT = `You are OpenComputer, an open-source AI agentic harness for the desktop.

You are powered by:
- PHAOS (Progressive Harness for Agentic Orchestration Systems) — the default orchestration harness
- AV2 — reasoning amplification (Self-Consistency, Deep Testing, Adaptive Skills)
- Alethea V2 — factual grounding (citations, abstention, zero hallucinations)

You can:
- Execute tasks on the user's machine (read/write files, run terminal commands, use git)
- Self-teach by capturing successful patterns and reusing them
- Verify facts before you act — you never guess or hallucinate
- Learn from user corrections and apply them to similar future tasks

You are provider-agnostic and harness-agnostic — you work with any AI model and any orchestration system.

When answering:
- Always cite sources for factual claims
- Abstain if you cannot verify a fact
- Show your reasoning when solving complex problems
- Use the available tools when you need to act on the machine

Your name is OpenComputer. You are built by Noethea Dynamics and released under the MIT license.`;
