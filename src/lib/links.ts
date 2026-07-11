/**
 * Link detection and preview utilities.
 */

import type { LinkPreviewData } from '../types/chat';

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function detectLinks(text: string): string[] {
  return text.match(URL_REGEX) || [];
}

export function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const LINK_PREVIEW_CACHE = new Map<string, LinkPreviewData | null>();

export async function getLinkPreview(url: string): Promise<LinkPreviewData | null> {
  if (LINK_PREVIEW_CACHE.has(url)) {
    return LINK_PREVIEW_CACHE.get(url) || null;
  }

  const preview: LinkPreviewData = {
    url,
    hostname: extractHostname(url),
  };

  LINK_PREVIEW_CACHE.set(url, preview);
  return preview;
}

export function renderContentWithLinks(text: string): (string | JSX.Element)[] {
  const parts = text.split(URL_REGEX);
  const matches = text.match(URL_REGEX) || [];

  const result: (string | JSX.Element)[] = [];
  parts.forEach((part, i) => {
    if (part) result.push(part);
    if (matches[i]) {
      const escapedUrl = escapeHtml(matches[i]);
      const escapedText = escapeHtml(matches[i]);
      result.push(
        `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline hover:text-blue-300 transition-colors">${escapedText}</a>`
      );
    }
  });

  return result;
}
