import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  FileCode,
  FileJson,
  FileText,
  FileType,
  FileImage,
  Settings,
  Hash,
  Plus,
  Minus,
  Trash2,
  Eye,
  type LucideIcon,
} from "lucide-react";
import type { FileStatus } from "@/types/git";

const EXT_ICONS: Record<string, LucideIcon> = {
  js: FileCode,
  jsx: FileCode,
  ts: FileCode,
  tsx: FileCode,
  py: FileCode,
  json: FileJson,
  md: FileText,
  html: FileType,
  css: FileType,
  rs: Hash,
  yaml: Settings,
  yml: Settings,
  toml: Settings,
  png: FileImage,
  jpg: FileImage,
  svg: FileImage,
};

function getFileIcon(name: string): LucideIcon {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  return EXT_ICONS[ext] ?? FileText;
}

function StatusBadge({ status }: { status: FileStatus["status"] }) {
  const config = {
    added: { icon: Plus, color: "text-oc-accent", bg: "bg-oc-accent/10" },
    modified: { icon: FileCode, color: "text-yellow-400", bg: "bg-yellow-400/10" },
    deleted: { icon: Trash2, color: "text-oc-danger", bg: "bg-oc-danger/10" },
    renamed: { icon: FileCode, color: "text-blue-400", bg: "bg-blue-400/10" },
    untracked: { icon: Circle, color: "text-oc-text-secondary", bg: "bg-oc-text-secondary/10" },
  } as const;

  const { icon: Icon, color, bg } = config[status] || config.modified;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ${bg} ${color}`}>
      <Icon size={10} />
      {status}
    </span>
  );
}

interface StatusViewProps {
  staged: FileStatus[];
  unstaged: FileStatus[];
  untracked: FileStatus[];
  onStageFile: (filePath: string) => void;
  onUnstageFile: (filePath: string) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onViewDiff: (filePath: string) => void;
}

function FileRow({
  file,
  staged,
  onAction,
  onViewDiff,
}: {
  file: FileStatus;
  staged: boolean;
  onAction: (path: string) => void;
  onViewDiff: (path: string) => void;
}) {
  const Icon = getFileIcon(file.path);
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-oc-surface/50"
    >
      <Icon size={14} className="shrink-0 text-oc-text-secondary" />
      <span className="min-w-0 flex-1 truncate text-oc-text-primary">
        {file.path}
      </span>
      <StatusBadge status={file.status} />
      <button
        type="button"
        onClick={() => onViewDiff(file.path)}
        className="shrink-0 rounded p-1 text-oc-text-secondary opacity-0 transition-opacity hover:text-oc-accent group-hover:opacity-100"
        title="View diff"
      >
        <Eye size={14} />
      </button>
      <button
        type="button"
        onClick={() => onAction(file.path)}
        className={`shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 ${
          staged
            ? "text-oc-text-secondary hover:text-yellow-400"
            : "text-oc-text-secondary hover:text-oc-accent"
        }`}
        title={staged ? "Unstage" : "Stage"}
      >
        {staged ? <Minus size={14} /> : <Plus size={14} />}
      </button>
    </motion.div>
  );
}

export function StatusView({
  staged,
  unstaged,
  untracked,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onUnstageAll,
  onViewDiff,
}: StatusViewProps) {
  return (
    <div className="space-y-3">
      {/* Staged */}
      {staged.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between px-2">
            <h4 className="text-xs font-medium text-oc-accent">
              Staged Changes ({staged.length})
            </h4>
            <button
              type="button"
              onClick={onUnstageAll}
              className="text-[10px] text-oc-text-secondary hover:text-oc-accent"
            >
              Unstage All
            </button>
          </div>
          <div className="rounded-xl border border-oc-accent/20 p-1">
            {staged.map((f) => (
              <FileRow
                key={f.path}
                file={f}
                staged
                onAction={onUnstageFile}
                onViewDiff={onViewDiff}
              />
            ))}
          </div>
        </div>
      )}

      {/* Unstaged */}
      {unstaged.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between px-2">
            <h4 className="text-xs font-medium text-yellow-400">
              Unstaged Changes ({unstaged.length})
            </h4>
            <button
              type="button"
              onClick={onStageAll}
              className="text-[10px] text-oc-text-secondary hover:text-oc-accent"
            >
              Stage All
            </button>
          </div>
          <div className="rounded-xl border border-yellow-400/20 p-1">
            {unstaged.map((f) => (
              <FileRow
                key={f.path}
                file={f}
                staged={false}
                onAction={onStageFile}
                onViewDiff={onViewDiff}
              />
            ))}
          </div>
        </div>
      )}

      {/* Untracked */}
      {untracked.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between px-2">
            <h4 className="text-xs font-medium text-oc-text-secondary">
              Untracked Files ({untracked.length})
            </h4>
            <button
              type="button"
              onClick={onStageAll}
              className="text-[10px] text-oc-text-secondary hover:text-oc-accent"
            >
              Stage All
            </button>
          </div>
          <div className="rounded-xl border border-oc-surface-border p-1">
            {untracked.map((f) => (
              <FileRow
                key={f.path}
                file={f}
                staged={false}
                onAction={onStageFile}
                onViewDiff={onViewDiff}
              />
            ))}
          </div>
        </div>
      )}

      {staged.length === 0 && unstaged.length === 0 && untracked.length === 0 && (
        <div className="flex flex-col items-center py-8 text-center">
          <CheckCircle2 size={32} className="mb-2 text-oc-accent" />
          <p className="text-sm text-oc-text-secondary">Working tree clean</p>
        </div>
      )}
    </div>
  );
}
