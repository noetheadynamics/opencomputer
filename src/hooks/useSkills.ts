import { useState, useCallback, useEffect } from "react";
import type { Skill, SkillImportResult } from "@/types/skills";
import * as skillsLib from "@/lib/skills";

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await skillsLib.listSkills();
      setSkills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const exportSkills = useCallback(async (ids: string[]) => {
    return skillsLib.exportSkills(ids);
  }, []);

  const importSkills = useCallback(async (file: File): Promise<SkillImportResult> => {
    const result = await skillsLib.importSkills(file);
    await refresh();
    return result;
  }, [refresh]);

  const toggleSkill = useCallback(async (id: string, enabled: boolean) => {
    const ok = await skillsLib.toggleSkill(id, enabled);
    if (ok) {
      setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
    } else {
      setError("Failed to toggle skill");
    }
  }, []);

  const deleteSkill = useCallback(async (id: string) => {
    const ok = await skillsLib.deleteSkill(id);
    if (ok) {
      setSkills((prev) => prev.filter((s) => s.id !== id));
    } else {
      setError("Failed to delete skill");
    }
  }, []);

  return { skills, loading, error, refresh, exportSkills, importSkills, toggleSkill, deleteSkill };
}
