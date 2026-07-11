import { useState, useCallback, useEffect } from "react";
import type { Skill, SkillImportResult } from "@/types/skills";
import * as skillsLib from "@/lib/skills";

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await skillsLib.listSkills();
    setSkills(data);
    setLoading(false);
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
    await skillsLib.toggleSkill(id, enabled);
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled } : s)),
    );
  }, []);

  const deleteSkill = useCallback(async (id: string) => {
    await skillsLib.deleteSkill(id);
    setSkills((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { skills, loading, refresh, exportSkills, importSkills, toggleSkill, deleteSkill };
}
