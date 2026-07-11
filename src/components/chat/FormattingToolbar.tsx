import React from 'react';
import { Bold, Italic, Code, List, Link, Quote } from 'lucide-react';

interface FormattingToolbarProps {
  onFormat: (prefix: string, suffix: string) => void;
}

const formatActions = [
  { icon: Bold, label: 'Bold', prefix: '**', suffix: '**' },
  { icon: Italic, label: 'Italic', prefix: '_', suffix: '_' },
  { icon: Code, label: 'Code', prefix: '`', suffix: '`' },
  { icon: List, label: 'List', prefix: '- ', suffix: '' },
  { icon: Link, label: 'Link', prefix: '[', suffix: '](url)' },
  { icon: Quote, label: 'Quote', prefix: '> ', suffix: '' },
];

export const FormattingToolbar: React.FC<FormattingToolbarProps> = ({ onFormat }) => {
  return (
    <div className="flex items-center gap-1 px-2 py-1 border-t border-oc-surface-border">
      {formatActions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            onClick={() => onFormat(action.prefix, action.suffix)}
            title={action.label}
            className="p-1.5 rounded hover:bg-oc-surface/50 text-oc-text-secondary hover:text-oc-text-primary transition-colors"
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
};
