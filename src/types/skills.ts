export interface Skill {
  id: string;
  name: string;
  description: string;
  command: string;
  enabled: boolean;
  score: number;
  usageCount: number;
  tags: string[];
  createdAt: string;
  pattern?: string;
}

export interface SkillExport {
  version: 1;
  exportedAt: string;
  skills: Skill[];
}

export interface SkillImportResult {
  imported: number;
  belowThreshold: number;
  errors: string[];
}
