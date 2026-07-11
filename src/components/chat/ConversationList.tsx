/**
 * Sidebar list of conversations.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, MessageSquare } from 'lucide-react';
import { useConversations } from '../../hooks/useConversations';
import { ConversationItem } from './ConversationItem';

export const ConversationList: React.FC = () => {
  const {
    conversations,
    activeId,
    loading,
    error,
    create,
    rename,
    remove,
    setActiveId,
  } = useConversations();

  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredConversations = searchQuery
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  const handleCreate = async () => {
    try {
      await create('New Chat');
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const handleRename = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setRenamingId(id);
      setRenameValue(conv.title);
    }
  };

  const handleRenameSave = async () => {
    if (renamingId && renameValue.trim()) {
      await rename(renamingId, renameValue.trim());
      setRenamingId(null);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleDeleteConfirm = async () => {
    if (confirmDeleteId) {
      await remove(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <MessageSquare className="w-4 h-4" />
          Conversations
        </div>
        <button
          onClick={handleCreate}
          className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
          title="New Chat"
        >
          <Plus className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/30"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {loading ? (
          <div className="text-center text-zinc-500 text-xs py-4">Loading...</div>
        ) : error ? (
          <div className="text-center text-red-400 text-xs py-4">{error}</div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center text-zinc-500 text-xs py-4">
            {searchQuery ? 'No matching conversations' : 'No conversations yet'}
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeId}
              onClick={() => setActiveId(conv.id)}
              onRename={() => handleRename(conv.id)}
              onDelete={() => handleDelete(conv.id)}
            />
          ))
        )}
      </div>

      {/* Rename Modal */}
      <AnimatePresence>
        {renamingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setRenamingId(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="oc-glass-modal p-4 w-80"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-medium text-zinc-100 mb-3">Rename Conversation</h3>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-emerald-500/50"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleRenameSave()}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleRenameSave}
                  className="flex-1 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                >
                  Save
                </button>
                <button
                  onClick={() => setRenamingId(null)}
                  className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {confirmDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setConfirmDeleteId(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="oc-glass-modal p-4 w-80"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-medium text-zinc-100 mb-2">Delete Conversation</h3>
              <p className="text-xs text-zinc-400 mb-4">
                This will permanently delete this conversation and all its messages.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
