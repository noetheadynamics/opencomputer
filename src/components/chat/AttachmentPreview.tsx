import React from 'react';
import { FileText, Image, Code, File, X } from 'lucide-react';
import { formatFileSize, getFileType } from '../../lib/upload';
import type { ChatAttachment } from '../../types/chat';

interface AttachmentPreviewProps {
  file: ChatAttachment;
  mini?: boolean;
  onRemove?: (id: string) => void;
}

const iconMap = {
  file: File,
  image: Image,
  code: Code,
  document: FileText,
};

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ file, mini, onRemove }) => {
  const Icon = iconMap[getFileType(file.name)] || File;
  const fileType = getFileType(file.name);

  if (mini) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-oc-surface/50 rounded-md border border-oc-surface-border text-xs">
        <Icon size={12} className="text-oc-text-secondary" />
        <span className="text-oc-text-primary truncate max-w-[120px]">{file.name}</span>
      </div>
    );
  }

  return (
    <div className="relative group p-3 bg-oc-surface/50 rounded-lg border border-oc-surface-border">
      {onRemove && (
        <button
          onClick={() => onRemove(file.id)}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X size={12} />
        </button>
      )}
      {file.thumbnail && fileType === 'image' ? (
        <img src={file.thumbnail} alt={file.name} className="w-full h-32 object-cover rounded-md mb-2" />
      ) : (
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-md bg-oc-surface flex items-center justify-center">
            <Icon size={20} className="text-oc-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-oc-text-primary truncate">{file.name}</div>
            <div className="text-xs text-oc-text-secondary">{formatFileSize(file.size)}</div>
          </div>
        </div>
      )}
      {file.content && fileType === 'code' && (
        <pre className="text-xs text-oc-text-secondary bg-oc-bg/50 rounded p-2 max-h-24 overflow-auto">
          {file.content.substring(0, 500)}
        </pre>
      )}
    </div>
  );
};
