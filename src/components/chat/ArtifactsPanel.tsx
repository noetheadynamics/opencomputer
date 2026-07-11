import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Code, FileText, Image, Copy, Check, ChevronRight } from 'lucide-react';
import type { Artifact } from '../../types/chat';

interface ArtifactsPanelProps {
  artifacts: Artifact[];
  isOpen: boolean;
  onClose: () => void;
}

const iconMap = {
  code: Code,
  file: FileText,
  result: FileText,
  image: Image,
};

export const ArtifactsPanel: React.FC<ArtifactsPanelProps> = ({ artifacts, isOpen, onClose }) => {
  const [selected, setSelected] = useState<Artifact | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed right-0 top-0 h-full w-[480px] bg-oc-bg/95 backdrop-blur-lg border-l border-oc-surface-border z-40 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-oc-surface-border">
            <div className="flex items-center gap-2">
              <Code size={16} className="text-oc-accent" />
              <span className="text-sm font-medium text-oc-text-primary">Artifacts</span>
              <span className="text-xs text-oc-text-secondary">({artifacts.length})</span>
            </div>
            <button onClick={onClose} className="text-oc-text-secondary hover:text-oc-text-primary">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Artifact list */}
            <div className="w-48 border-r border-oc-surface-border overflow-y-auto">
              {artifacts.length === 0 ? (
                <div className="p-4 text-xs text-oc-text-secondary text-center">
                  No artifacts yet.
                </div>
              ) : (
                artifacts.map((a) => {
                  const Icon = iconMap[a.type] || Code;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelected(a)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        selected?.id === a.id
                          ? 'bg-oc-accent/10 text-oc-accent'
                          : 'text-oc-text-primary hover:bg-oc-surface/50'
                      }`}
                    >
                      <Icon size={14} className="shrink-0" />
                      <span className="truncate">{a.title}</span>
                      <ChevronRight size={12} className="ml-auto shrink-0 text-oc-text-secondary/40" />
                    </button>
                  );
                })
              )}
            </div>

            {/* Artifact content */}
            <div className="flex-1 overflow-y-auto">
              {selected ? (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-medium text-oc-text-primary">{selected.title}</h3>
                      <span className="text-xs text-oc-text-secondary">{selected.type} {selected.language && `· ${selected.language}`}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(selected.content)}
                      className="oc-glass-btn px-2 py-1 text-xs flex items-center gap-1"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="text-xs text-oc-text-primary bg-oc-surface/30 rounded-md p-3 overflow-auto whitespace-pre-wrap font-mono">
                    {selected.content}
                  </pre>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-oc-text-secondary">
                  Select an artifact to view
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
