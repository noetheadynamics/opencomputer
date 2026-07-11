import { useState, useCallback } from 'react';
import type { Artifact } from '../types/chat';

export function useArtifacts() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  const addArtifact = useCallback((artifact: Omit<Artifact, 'id' | 'createdAt'>) => {
    const newArtifact: Artifact = {
      ...artifact,
      id: `art_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    setArtifacts((prev) => [...prev, newArtifact]);
    setPanelOpen(true);
    return newArtifact;
  }, []);

  const removeArtifact = useCallback((id: string) => {
    setArtifacts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearArtifacts = useCallback(() => {
    setArtifacts([]);
  }, []);

  const togglePanel = useCallback(() => {
    setPanelOpen((prev) => !prev);
  }, []);

  return { artifacts, panelOpen, addArtifact, removeArtifact, clearArtifacts, togglePanel, setPanelOpen };
}
