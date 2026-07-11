/**
 * Web Search API client.
 */

import type { SearchResponse, SearchHistoryEntry, ScrapeResult, SearchEngineInfo } from '../types/search';
import { PHAOS_BASE } from './config';

export const searchApi = {
  search: async (query: string, engine?: string, limit = 10, filters?: Record<string, unknown>): Promise<SearchResponse> => {
    const res = await fetch(`${PHAOS_BASE}/api/search/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, engine, limit, filters, save_history: true }),
    });
    if (!res.ok) throw new Error(`Search failed: ${res.statusText}`);
    return res.json();
  },

  scrape: async (url: string, format = 'markdown'): Promise<ScrapeResult> => {
    const res = await fetch(`${PHAOS_BASE}/api/search/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, format }),
    });
    if (!res.ok) throw new Error(`Scrape failed: ${res.statusText}`);
    return res.json();
  },

  crawl: async (url: string, depth = 2, maxPages = 10) => {
    const res = await fetch(`${PHAOS_BASE}/api/search/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, depth, max_pages: maxPages }),
    });
    if (!res.ok) throw new Error(`Crawl failed: ${res.statusText}`);
    return res.json();
  },

  getHistory: async (limit = 50, offset = 0, query?: string): Promise<{ searches: SearchHistoryEntry[]; limit: number; offset: number }> => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (query) params.set('query', query);
    const res = await fetch(`${PHAOS_BASE}/api/search/history?${params}`);
    if (!res.ok) throw new Error(`Failed to get history: ${res.statusText}`);
    return res.json();
  },

  getSearch: async (searchId: string): Promise<SearchHistoryEntry> => {
    const res = await fetch(`${PHAOS_BASE}/api/search/history/${searchId}`);
    if (!res.ok) throw new Error(`Failed to get search: ${res.statusText}`);
    return res.json();
  },

  deleteSearch: async (searchId: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/search/history/${searchId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete search: ${res.statusText}`);
    return res.json();
  },

  clearHistory: async (): Promise<{ success: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/search/history`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to clear history: ${res.statusText}`);
    return res.json();
  },

  toggleFavorite: async (searchId: string, favorite: boolean): Promise<{ success: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/search/history/${searchId}/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite }),
    });
    if (!res.ok) throw new Error(`Failed to toggle favorite: ${res.statusText}`);
    return res.json();
  },

  getFavorites: async (limit = 50): Promise<{ favorites: SearchHistoryEntry[] }> => {
    const res = await fetch(`${PHAOS_BASE}/api/search/favorites?limit=${limit}`);
    if (!res.ok) throw new Error(`Failed to get favorites: ${res.statusText}`);
    return res.json();
  },

  getEngines: async (): Promise<{ engines: SearchEngineInfo[]; default: string }> => {
    const res = await fetch(`${PHAOS_BASE}/api/search/engines`);
    if (!res.ok) throw new Error(`Failed to get engines: ${res.statusText}`);
    return res.json();
  },

  getStats: async (): Promise<{ total: number; favorites: number }> => {
    const res = await fetch(`${PHAOS_BASE}/api/search/stats`);
    if (!res.ok) throw new Error(`Failed to get stats: ${res.statusText}`);
    return res.json();
  },
};
