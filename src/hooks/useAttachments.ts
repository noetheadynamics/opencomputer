import { useState, useCallback } from 'react';
import { uploadFile } from '../lib/upload';
import type { ChatAttachment } from '../types/chat';

export function useAttachments() {
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    try {
      const newAtts: ChatAttachment[] = [];
      for (const file of Array.from(files)) {
        const uploaded = await uploadFile(file);
        newAtts.push({ ...uploaded, type: uploaded.type as ChatAttachment['type'] });
      }
      setAttachments((prev) => [...prev, ...newAtts]);
      return newAtts;
    } finally {
      setUploading(false);
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  return { attachments, uploading, addFiles, removeAttachment, clearAttachments };
}
