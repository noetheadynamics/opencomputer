/**
 * Configure the AI's identity (system prompt).
 */

import React, { useState } from 'react';
import { Bot, Save, RotateCcw } from 'lucide-react';
import { DEFAULT_SYSTEM_PROMPT } from '../../types/conversation';

interface SystemPromptEditorProps {
  value: string;
  onSave: (prompt: string) => void;
}

export const SystemPromptEditor: React.FC<SystemPromptEditorProps> = ({
  value,
  onSave,
}) => {
  const [prompt, setPrompt] = useState(value || DEFAULT_SYSTEM_PROMPT);
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    setHasChanges(e.target.value !== value);
  };

  const handleSave = () => {
    onSave(prompt);
    setHasChanges(false);
  };

  const handleReset = () => {
    setPrompt(DEFAULT_SYSTEM_PROMPT);
    setHasChanges(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bot className="w-5 h-5 text-emerald-400" />
        <h3 className="text-sm font-medium text-zinc-100">AI Identity (System Prompt)</h3>
      </div>

      <p className="text-xs text-zinc-400">
        This system prompt defines the AI's identity and behavior. It is sent with every message
        in this conversation.
      </p>

      <textarea
        value={prompt}
        onChange={handleChange}
        className="w-full h-64 px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 resize-none font-mono focus:outline-none focus:border-emerald-500/50"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
            hasChanges
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          }`}
        >
          <Save className="w-3 h-3" />
          Save
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset to Default
        </button>
      </div>
    </div>
  );
};
