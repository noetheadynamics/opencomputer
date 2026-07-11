/**
 * Web Search types for OpenComputer.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  timestamp: string;
}

export interface SearchResponse {
  query: string;
  engine: string;
  results: SearchResult[];
  count: number;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  engine: string;
  results: SearchResult[];
  filters: Record<string, unknown> | null;
  result_count: number;
  is_favorite: number;
  created_at: string;
}

export interface ScrapeResult {
  url: string;
  title: string;
  description: string;
  content: string;
  format: string;
  links: { text: string; url: string }[];
  images: { alt: string; src: string }[];
  timestamp: string;
  error?: string;
}

export interface SearchEngineInfo {
  id: string;
  name: string;
  requires_key: boolean;
}
