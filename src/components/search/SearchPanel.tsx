/**
 * Search Panel — main web search UI with tabs for results, history, and saved searches.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Globe, Star, Trash2, Filter, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { searchApi } from '../../lib/search';
import type { SearchResult, SearchHistoryEntry, SearchEngineInfo, ScrapeResult } from '../../types/search';

export const SearchPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [engine, setEngine] = useState('duckduckgo');
  const [engines, setEngines] = useState<SearchEngineInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'results' | 'history' | 'saved'>('results');
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<SearchHistoryEntry[]>([]);
  const [scraped, setScraped] = useState<Record<string, ScrapeResult>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState('');

  const loadEngines = useCallback(async () => {
    try {
      const data = await searchApi.getEngines();
      setEngines(data.engines);
      setEngine(data.default);
    } catch {}
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const data = await searchApi.getHistory(50);
      setHistory(data.searches);
    } catch {}
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const data = await searchApi.getFavorites();
      setFavorites(data.favorites);
    } catch {}
  }, []);

  useEffect(() => { loadEngines(); }, [loadEngines]);
  useEffect(() => { if (activeTab === 'history') loadHistory(); }, [activeTab, loadHistory]);
  useEffect(() => { if (activeTab === 'saved') loadFavorites(); }, [activeTab, loadFavorites]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const filters: Record<string, unknown> = {};
      if (domainFilter.trim()) filters.domain = domainFilter.trim();
      const data = await searchApi.search(query, engine, 10, Object.keys(filters).length ? filters : undefined);
      setResults(data.results);
      setActiveTab('results');
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async (url: string) => {
    if (scraped[url]) {
      setExpanded(expanded === url ? null : url);
      return;
    }
    try {
      const result = await searchApi.scrape(url);
      setScraped((prev) => ({ ...prev, [url]: result }));
      setExpanded(url);
    } catch (err) {
      console.error('Scrape failed:', err);
    }
  };

  const handleToggleFavorite = async (searchId: string, current: boolean) => {
    try {
      await searchApi.toggleFavorite(searchId, !current);
      loadHistory();
      loadFavorites();
    } catch {}
  };

  const handleDelete = async (searchId: string) => {
    try {
      await searchApi.deleteSearch(searchId);
      loadHistory();
      loadFavorites();
    } catch {}
  };

  const handleExport = (format: 'markdown' | 'json') => {
    let content: string;
    let filename: string;
    if (format === 'json') {
      content = JSON.stringify(results, null, 2);
      filename = `search_${query.replace(/\s+/g, '_')}.json`;
    } else {
      content = results.map((r, i) => `## ${i + 1}. ${r.title}\n\n${r.snippet}\n\n[${r.url}](${r.url})\n`).join('\n---\n\n');
      filename = `search_${query.replace(/\s+/g, '_')}.md`;
    }
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderResults = () => (
    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
      {results.length === 0 && !loading && (
        <div className="text-center text-zinc-500 text-sm py-8">No results yet. Try a search.</div>
      )}
      {results.map((r, i) => (
        <div key={i} className="oc-glass-panel p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <a href={r.url} target="_blank" rel="noopener noreferrer"
               className="text-sm font-medium text-emerald-400 hover:underline flex items-center gap-1">
              {r.title} <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-xs text-zinc-500 shrink-0">{r.source}</span>
          </div>
          <p className="text-xs text-zinc-400">{r.snippet}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-600 truncate max-w-[70%]">{r.url}</span>
            <button onClick={() => handleScrape(r.url)}
                    className="oc-glass-btn px-2 py-0.5 text-xs flex items-center gap-1">
              {expanded === r.url ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {expanded === r.url ? 'Hide' : 'Preview'}
            </button>
          </div>
          {expanded === r.url && scraped[r.url] && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        className="oc-glass-panel p-3 text-xs text-zinc-400 max-h-48 overflow-y-auto whitespace-pre-wrap">
              {scraped[r.url].error ? (
                <span className="text-red-400">{scraped[r.url].error}</span>
              ) : (
                scraped[r.url].content.substring(0, 2000)
              )}
            </motion.div>
          )}
        </div>
      ))}
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
      {history.length === 0 && (
        <div className="text-center text-zinc-500 text-sm py-8">No search history.</div>
      )}
      {history.map((h) => (
        <div key={h.id} className="oc-glass-panel p-3 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-zinc-200 truncate">{h.query}</div>
            <div className="text-xs text-zinc-500">{h.engine} · {h.result_count} results · {new Date(h.created_at).toLocaleDateString()}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => { setQuery(h.query); handleSearch(); }}
                    className="oc-glass-btn p-1" title="Re-run">
              <Search className="w-3 h-3" />
            </button>
            <button onClick={() => handleToggleFavorite(h.id, !!h.is_favorite)}
                    className="oc-glass-btn p-1" title="Favorite">
              <Star className={`w-3 h-3 ${h.is_favorite ? 'text-yellow-400 fill-yellow-400' : ''}`} />
            </button>
            <button onClick={() => handleDelete(h.id)}
                    className="oc-glass-btn p-1 text-red-400" title="Delete">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderSaved = () => (
    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
      {favorites.length === 0 && (
        <div className="text-center text-zinc-500 text-sm py-8">No saved searches.</div>
      )}
      {favorites.map((h) => (
        <div key={h.id} className="oc-glass-panel p-3 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-zinc-200 truncate">{h.query}</div>
            <div className="text-xs text-zinc-500">{h.engine} · {h.result_count} results</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => { setQuery(h.query); handleSearch(); }}
                    className="oc-glass-btn p-1" title="Re-run">
              <Search className="w-3 h-3" />
            </button>
            <button onClick={() => handleToggleFavorite(h.id, true)}
                    className="oc-glass-btn p-1 text-red-400" title="Unsave">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="oc-glass-panel p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Globe className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-semibold text-zinc-100">Web Search</h2>
      </div>

      <div className="flex gap-2">
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
               placeholder="Search the web..."
               className="oc-glass-input flex-1 text-sm" />
        <select value={engine} onChange={(e) => setEngine(e.target.value)}
                className="oc-glass-input text-xs w-32">
          {engines.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <button onClick={handleSearch} disabled={loading}
                className="oc-glass-btn-primary px-4 py-1.5 text-sm">
          {loading ? '...' : 'Search'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-zinc-500" />
        <input type="text" value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}
               placeholder="Filter by domain..."
               className="oc-glass-input text-xs flex-1" />
      </div>

      <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
        <div className="flex gap-1">
          {(['results', 'history', 'saved'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-xs rounded-t-lg transition-colors ${
                      activeTab === tab
                        ? 'bg-zinc-800/50 text-emerald-400 border-b-2 border-emerald-400'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}>
              {tab === 'results' ? 'Results' : tab === 'history' ? 'History' : 'Saved'}
            </button>
          ))}
        </div>
        {activeTab === 'results' && results.length > 0 && (
          <div className="flex gap-1">
            <button onClick={() => handleExport('markdown')} className="oc-glass-btn px-2 py-0.5 text-xs">MD</button>
            <button onClick={() => handleExport('json')} className="oc-glass-btn px-2 py-0.5 text-xs">JSON</button>
          </div>
        )}
      </div>

      {activeTab === 'results' && renderResults()}
      {activeTab === 'history' && renderHistory()}
      {activeTab === 'saved' && renderSaved()}
    </motion.div>
  );
};
