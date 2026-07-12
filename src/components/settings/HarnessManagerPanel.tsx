/**
 * Harness Manager Panel - UI for managing harnesses.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Zap,
  FileText,
  Terminal,
  GitBranch,
  Clock,
} from 'lucide-react';
import { useHarness } from '../../hooks/useHarness';

export const HarnessManagerPanel: React.FC = () => {
  const {
    harnesses,
    activeHarnessId,
    loading,
    error,
    refresh,
    activate,
    uninstall,
  } = useHarness();

  const [showInstallModal, setShowInstallModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleActivate = async (harnessId: string) => {
    try {
      await activate(harnessId);
    } catch (err) {
      console.error('Failed to activate harness:', err);
    }
  };

  const handleUninstall = async (harnessId: string) => {
    try {
      await uninstall(harnessId);
      setConfirmDelete(null);
    } catch (err) {
      console.error('Failed to uninstall harness:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-emerald-400';
      case 'inactive':
        return 'text-zinc-500';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-zinc-500';
    }
  };

  const getCapabilityIcon = (supported: boolean) => {
    return supported ? (
      <Check className="w-4 h-4 text-emerald-400" />
    ) : (
      <span className="w-4 h-4 text-zinc-600">-</span>
    );
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col p-4">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 text-zinc-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4">
    <div className="flex flex-col flex-1 min-h-0 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Harness Manager</h2>
        </div>
        <button
          onClick={refresh}
          className="oc-glass-btn px-3 py-1.5 text-sm flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="oc-glass-panel p-4 border border-red-500/20"
          >
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Harness Info */}
      {activeHarnessId && (
        <div className="oc-glass-panel p-4">
          <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>Active Harness</span>
          </div>
          <div className="text-lg font-medium text-zinc-100">
            {harnesses.find((h) => h.id === activeHarnessId)?.name || activeHarnessId}
          </div>
        </div>
      )}

      {/* Harness List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        <h3 className="text-sm font-medium text-zinc-400">Installed Harnesses</h3>
        
        {harnesses.length === 0 ? (
          <div className="oc-glass-panel p-8 text-center text-zinc-500">
            No harnesses installed
          </div>
        ) : (
          <div className="space-y-2">
            {harnesses.map((harness) => (
              <motion.div
                key={harness.id}
                layout
                className={`oc-glass-panel p-4 ${
                  harness.id === activeHarnessId
                    ? 'border border-emerald-500/30'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-100">{harness.name}</span>
                      <span className="text-xs text-zinc-500">v{harness.version}</span>
                      <span className={`text-xs ${getStatusColor(harness.status)}`}>
                        {harness.status}
                      </span>
                      {harness.id === activeHarnessId && (
                        <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-400 mt-1">{harness.description}</p>
                    
                    {/* Capabilities */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                      <div className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        <span>Files</span>
                        {getCapabilityIcon(harness.supports_file_tools)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Terminal className="w-3 h-3" />
                        <span>Terminal</span>
                        {getCapabilityIcon(harness.supports_terminal)}
                      </div>
                      <div className="flex items-center gap-1">
                        <GitBranch className="w-3 h-3" />
                        <span>Git</span>
                        {getCapabilityIcon(harness.supports_git)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Cron</span>
                        {getCapabilityIcon(harness.supports_cron)}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    {harness.id !== activeHarnessId && (
                      <button
                        onClick={() => handleActivate(harness.id)}
                        className="oc-glass-btn px-3 py-1 text-sm text-emerald-400 hover:text-emerald-300"
                      >
                        Activate
                      </button>
                    )}
                    {harness.id !== 'phaos' && harness.id !== activeHarnessId && (
                      <button
                        onClick={() => setConfirmDelete(harness.id)}
                        className="oc-glass-btn px-2 py-1 text-sm text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Delete Confirmation */}
                <AnimatePresence>
                  {confirmDelete === harness.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 pt-3 border-t border-zinc-700"
                    >
                      <p className="text-sm text-zinc-400 mb-2">
                        Are you sure you want to uninstall {harness.name}?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUninstall(harness.id)}
                          className="oc-glass-btn px-3 py-1 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        >
                          Uninstall
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="oc-glass-btn px-3 py-1 text-sm text-zinc-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Install Custom Harness Button */}
      <button
        onClick={() => setShowInstallModal(true)}
        className="oc-glass-btn w-full py-3 flex items-center justify-center gap-2 text-sm"
      >
        <Plus className="w-4 h-4" />
        Install Custom Harness
      </button>

      {/* Install Modal Placeholder */}
      <AnimatePresence>
        {showInstallModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowInstallModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="oc-glass-modal p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                Install Custom Harness
              </h3>
              <p className="text-sm text-zinc-400 mb-4">
                Custom harness installation will be available in a future update.
                You'll be able to upload a ZIP file containing your harness code.
              </p>
              <button
                onClick={() => setShowInstallModal(false)}
                className="oc-glass-btn w-full py-2"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </div>
  );
};
