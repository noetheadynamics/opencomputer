import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Download, Upload, Search } from "lucide-react";
import { useSkills } from "@/hooks/useSkills";
import { SkillCard } from "./SkillCard";

const tapSpring = { type: "spring" as const, stiffness: 700, damping: 20 };

export function SkillsLibraryPanel() {
  const { skills, loading, exportSkills, importSkills, toggleSkill, deleteSkill } =
    useSkills();
  const [search, setSearch] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
  );

  async function handleExport() {
    const blob = await exportSkills(filtered.map((s) => s.id));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skills-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importSkills(file);
    setImportMsg(
      `Imported ${result.imported} skills` +
        (result.belowThreshold > 0
          ? `, ${result.belowThreshold} below threshold`
          : ""),
    );
    setTimeout(() => setImportMsg(null), 3000);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-oc-text-primary">
          Skills Library
        </h2>
        <span className="text-xs text-oc-text-secondary">
          {skills.length} skills
        </span>
      </div>

      {/* Search + Actions */}
      <div className="mb-4 flex gap-2">
        <div className="oc-glass-input flex flex-1 items-center gap-2">
          <Search size={14} className="text-oc-text-secondary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="w-full bg-transparent text-sm text-oc-text-primary outline-none placeholder:text-oc-text-secondary/50"
          />
        </div>
        <motion.button
          whileTap={{ scale: 0.95, transition: tapSpring }}
          onClick={handleExport}
          className="oc-glass-btn flex items-center gap-1 px-3 text-sm"
        >
          <Download size={14} />
          Export
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95, transition: tapSpring }}
          onClick={() => fileRef.current?.click()}
          className="oc-glass-btn flex items-center gap-1 px-3 text-sm"
        >
          <Upload size={14} />
          Import
        </motion.button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
      </div>

      {importMsg && (
        <div className="mb-3 rounded-xl bg-oc-accent/10 px-3 py-2 text-xs text-oc-accent">
          {importMsg}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="py-8 text-center text-sm text-oc-text-secondary">
            Loading...
          </p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-oc-text-secondary">
            No skills found.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onToggle={toggleSkill}
              onDelete={deleteSkill}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
