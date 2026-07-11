import type { Skill, SkillExport, SkillImportResult } from "@/types/skills";
import { PHAOS_BASE } from "./config";

let _cache: Skill[] | null = null;

export async function listSkills(): Promise<Skill[]> {
  try {
    const res = await fetch(`${PHAOS_BASE}/api/skills/`);
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    _cache = data.map((s: Record<string, unknown>) => ({
      ...s,
      score: (s.score as number) ?? 80,
      usageCount: (s.usageCount as number) ?? 0,
      tags: (s.tags as string[]) ?? [],
      createdAt: (s.createdAt as string) ?? new Date().toISOString(),
    })) as Skill[];
    return _cache;
  } catch {
    return _cache ?? [];
  }
}

export async function exportSkills(skillIds: string[]): Promise<Blob> {
  const skills = (_cache ?? []).filter((s) => skillIds.includes(s.id));
  const exported: SkillExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    skills,
  };
  return new Blob([JSON.stringify(exported, null, 2)], {
    type: "application/json",
  });
}

export async function importSkills(file: File): Promise<SkillImportResult> {
  const text = await file.text();
  const data = JSON.parse(text) as SkillExport;
  const result: SkillImportResult = { imported: 0, belowThreshold: 0, errors: [] };

  if (data.version !== 1) {
    result.errors.push("Unsupported export version");
    return result;
  }

  for (const skill of data.skills) {
    if (skill.score >= 60) {
      result.imported++;
    } else {
      result.belowThreshold++;
    }
  }
  return result;
}

export async function toggleSkill(
  skillId: string,
  enabled: boolean,
): Promise<boolean> {
  if (_cache) {
    const skill = _cache.find((s) => s.id === skillId);
    if (skill) skill.enabled = enabled;
  }
  return true;
}

export async function deleteSkill(skillId: string): Promise<boolean> {
  if (_cache) {
    _cache = _cache.filter((s) => s.id !== skillId);
  }
  return true;
}
