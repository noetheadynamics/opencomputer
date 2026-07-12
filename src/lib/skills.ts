import type { Skill, SkillExport, SkillImportResult } from "@/types/skills";
import { PHAOS_BASE } from "./config";

export async function listSkills(): Promise<Skill[]> {
  try {
    const res = await fetch(`${PHAOS_BASE}/api/skills/`);
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    return data.map((s: Record<string, unknown>) => ({
      id: s.id as string,
      name: s.name as string,
      description: s.description as string,
      command: s.command as string,
      enabled: (s.enabled as boolean) ?? true,
      score: (s.score as number) ?? 80,
      usageCount: (s.usageCount as number) ?? 0,
      tags: (s.tags as string[]) ?? [],
      createdAt: (s.createdAt as string) ?? new Date().toISOString(),
    })) as Skill[];
  } catch {
    return [];
  }
}

export async function exportSkills(skillIds: string[]): Promise<Blob> {
  const skills = (await listSkills()).filter((s) => skillIds.includes(s.id));
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
  let text: string;
  try {
    text = await file.text();
  } catch (e) {
    return { imported: 0, belowThreshold: 0, errors: [e instanceof Error ? e.message : "Failed to read file"] };
  }
  let data: SkillExport;
  try {
    data = JSON.parse(text) as SkillExport;
  } catch (e) {
    return { imported: 0, belowThreshold: 0, errors: [e instanceof Error ? e.message : "Invalid JSON"] };
  }
  const result: SkillImportResult = { imported: 0, belowThreshold: 0, errors: [] };

  if (data.version !== 1) {
    result.errors.push("Unsupported export version");
    return result;
  }

  for (const skill of data.skills) {
    if (skill.score >= 60) {
      try {
        const res = await fetch(`${PHAOS_BASE}/api/skills/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(skill),
        });
        if (res.ok) {
          result.imported++;
        } else {
          result.errors.push(`Failed to import skill "${skill.name}": HTTP ${res.status}`);
        }
      } catch (e) {
        result.errors.push(`Failed to import skill "${skill.name}": ${e instanceof Error ? e.message : "unknown"}`);
      }
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
  try {
    const res = await fetch(`${PHAOS_BASE}/api/skills/${skillId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteSkill(skillId: string): Promise<boolean> {
  try {
    const res = await fetch(`${PHAOS_BASE}/api/skills/${skillId}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}
