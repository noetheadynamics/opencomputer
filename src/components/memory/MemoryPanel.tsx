/**
 * MemoryPanel — combined view of all memory systems.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Layers, Database, BarChart3, Download, Search } from 'lucide-react';
import { TruthVaultViewer } from './TruthVaultViewer';
import { CrossSessionStateViewer } from './CrossSessionStateViewer';
import { MemoryStoreViewer } from './MemoryStoreViewer';
import { MemoryStats } from './MemoryStats';
import { FullMemoryExport } from './FullMemoryExport';
import { useMemory } from '../../hooks/useMemory';

type MemoryTab = 'truth-vault' | 'cross-session' | 'memory-store' | 'stats' | 'export' | 'search';

const TABS: { id: MemoryTab; label: string; icon: React.ReactNode }[] = [
  { id: 'truth-vault', label: 'Truth Vault', icon: <Shield className="w-4 h-4" /> },
  { id: 'cross-session', label: 'Cross-Session', icon: <Layers className="w-4 h-4" /> },
  { id: 'memory-store', label: 'Memory Store', icon: <Database className="w-4 h-4" /> },
  { id: 'stats', label: 'Stats', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'export', label: 'Export', icon: <Download className="w-4 h-4" /> },
  { id: 'search', label: 'Search All', icon: <Search className="w-4 h-4" /> },
];

export const MemoryPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MemoryTab>('stats');
  const { searchAll, searchResults, loading, error } = useMemory();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      await searchAll(searchQuery.trim());
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'truth-vault':
        return <TruthVaultViewer />;
      case 'cross-session':
        return <CrossSessionStateViewer />;
      case 'memory-store':
        return <MemoryStoreViewer />;
      case 'stats':
        return <MemoryStats />;
      case 'export':
        return <FullMemoryExport />;
      case 'search':
        return (
          <div className="oc-glass-panel p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-zinc-100">Unified Memory Search</h2>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search across Truth Vault, Memory Store, and Conversations..."
                className="oc-glass-input flex-1"
              />
              <button onClick={handleSearch} className="oc-glass-btn-primary px-4 py-1.5 text-xs">
                Search
              </button>
            </div>
            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</div>
            )}
            {loading && <div className="text-center text-zinc-500 text-sm py-4">Searching...</div>}
            {searchResults && (
              <div className="space-y-4">
                <SearchSection
                  title="Truth Vault"
                  count={searchResults.truth_vault.length}
                  items={searchResults.truth_vault.map((f) => ({
                    id: f.id,
                    primary: f.query,
                    secondary: f.answer.substring(0, 100),
                  }))}
                />
                <SearchSection
                  title="Memory Store"
                  count={searchResults.memory_store.length}
                  items={searchResults.memory_store.map((m) => ({
                    id: m.id,
                    primary: m.query,
                    secondary: m.response?.substring(0, 100),
                  }))}
                />
                <SearchSection
                  title="Conversations"
                  count={searchResults.conversations.length}
                  items={searchResults.conversations.map((c) => ({
                    id: c.id,
                    primary: c.title,
                    secondary: new Date(c.updated_at).toLocaleDateString(),
                  }))}
                />
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex gap-1 px-4 py-2 border-b border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

const SearchSection: React.FC<{
  title: string;
  count: number;
  items: { id: string; primary: string; secondary?: string }[];
}> = ({ title, count, items }) => (
  <div>
    <h3 className="text-sm font-medium text-zinc-300 mb-2">
      {title} <span className="text-zinc-600">({count})</span>
    </h3>
    {items.length === 0 ? (
      <div className="text-xs text-zinc-600">No results</div>
    ) : (
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="oc-glass-panel p-2 text-xs">
            <div className="text-zinc-200 truncate">{item.primary}</div>
            {item.secondary && <div className="text-zinc-500 truncate mt-0.5">{item.secondary}</div>}
          </div>
        ))}
      </div>
    )}
  </div>
);
