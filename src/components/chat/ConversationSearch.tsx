/**
 * Conversation Search — search across all conversations and messages.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, MessageSquare } from 'lucide-react';
import { memoryApi } from '../../lib/memory';

interface SearchResult {
  id: string;
  title: string;
  updated_at: string;
}

export const ConversationSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await memoryApi.searchAll(query.trim());
      setResults(data.conversations || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="oc-glass-panel p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-medium text-zinc-100">Search Conversations</h3>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search across all conversations..."
          className="oc-glass-input flex-1"
        />
        <button onClick={handleSearch} disabled={searching} className="oc-glass-btn-primary px-3 py-1.5 text-xs">
          {searching ? '...' : 'Search'}
        </button>
      </div>
      {results.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {results.map((r) => (
            <div key={r.id} className="oc-glass-panel p-2 flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-200 truncate">{r.title}</div>
                <div className="text-xs text-zinc-600">{new Date(r.updated_at).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {searching && <div className="text-center text-zinc-500 text-xs py-2">Searching...</div>}
    </motion.div>
  );
};
