import React, { useState, useEffect } from 'react';
import { getLinkPreview, extractHostname } from '../../lib/links';
import type { LinkPreviewData } from '../../types/chat';

interface LinkPreviewProps {
  url: string;
}

export const LinkPreview: React.FC<LinkPreviewProps> = ({ url }) => {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getLinkPreview(url).then((data) => {
      if (!cancelled) {
        setPreview(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className="p-2 bg-oc-surface/30 rounded-md border border-oc-surface-border animate-pulse">
        <div className="h-3 w-3/4 bg-oc-surface/50 rounded" />
        <div className="h-2 w-1/2 bg-oc-surface/50 rounded mt-1" />
      </div>
    );
  }

  if (!preview) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-2 bg-oc-surface/30 rounded-md border border-oc-surface-border hover:bg-oc-surface/50 transition-colors"
    >
      <div className="flex gap-3">
        {preview.image && (
          <img src={preview.image} alt="" className="w-16 h-16 object-cover rounded-md flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-oc-text-primary truncate">
            {preview.title || url}
          </div>
          {preview.description && (
            <div className="text-xs text-oc-text-secondary truncate">{preview.description}</div>
          )}
          <div className="text-xs text-oc-text-secondary/50 truncate">
            {preview.hostname || extractHostname(url)}
          </div>
        </div>
      </div>
    </a>
  );
};
