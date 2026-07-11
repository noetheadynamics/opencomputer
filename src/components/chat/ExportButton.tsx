/**
 * Export Button — export conversation in Markdown, JSON formats.
 */

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { conversationApi } from '../../lib/conversation';

interface ExportButtonProps {
  conversationId: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ conversationId }) => {
  const [exporting, setExporting] = useState(false);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (format: 'markdown' | 'json') => {
    setExporting(true);
    try {
      const conversation = await conversationApi.get(conversationId);
      const title = conversation.title || 'conversation';

      if (format === 'markdown') {
        let md = `# ${title}\n\n`;
        if (conversation.messages) {
          for (const msg of conversation.messages) {
            md += `## ${msg.role}\n\n${msg.content}\n\n---\n\n`;
          }
        }
        downloadBlob(new Blob([md], { type: 'text/markdown' }), `${title}.md`);
      } else {
        downloadBlob(
          new Blob([JSON.stringify(conversation, null, 2)], { type: 'application/json' }),
          `${title}.json`
        );
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex gap-1.5">
      <button
        onClick={() => handleExport('markdown')}
        disabled={exporting}
        className="oc-glass-btn px-2 py-1 text-xs flex items-center gap-1"
      >
        <Download className="w-3 h-3" />
        {exporting ? '...' : 'MD'}
      </button>
      <button
        onClick={() => handleExport('json')}
        disabled={exporting}
        className="oc-glass-btn px-2 py-1 text-xs flex items-center gap-1"
      >
        <Download className="w-3 h-3" />
        {exporting ? '...' : 'JSON'}
      </button>
    </div>
  );
};
