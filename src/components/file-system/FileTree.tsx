import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, FilePen, Trash2, Copy, type LucideIcon } from "lucide-react";
import { listDirectory } from "@/lib/fileSystem";
import type { FileEntry } from "@/types/fileSystem";
import { FileIcon } from "./FileIcon";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  rootPath: string;
  selectedFile?: string | null;
  onFileSelect: (path: string) => void;
  onNavigate: (dir: string) => void;
  onRequestRename: (path: string) => void;
  onRequestDelete: (path: string) => void;
  onCopyPath: (path: string) => void;
}

interface MenuState {
  path: string;
  x: number;
  y: number;
}

function formatSize(size: number): string {
  if (size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileTree({
  rootPath,
  selectedFile,
  onFileSelect,
  onNavigate,
  onRequestRename,
  onRequestDelete,
  onCopyPath,
}: FileTreeProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set([rootPath]));
  const [cache, setCache] = React.useState<Record<string, FileEntry[]>>({});
  const [loading, setLoading] = React.useState<Set<string>>(new Set());
  const [menu, setMenu] = React.useState<MenuState | null>(null);

  const load = React.useCallback(
    async (dir: string) => {
      if (cache[dir] || loading.has(dir)) return;
      setLoading((l) => new Set(l).add(dir));
      try {
        const entries = await listDirectory(dir, rootPath);
        setCache((c) => ({ ...c, [dir]: entries }));
      } catch {
        // errors surfaced by the panel; keep tree stable
      } finally {
        setLoading((l) => {
          const n = new Set(l);
          n.delete(dir);
          return n;
        });
      }
    },
    [cache, loading, rootPath],
  );

  React.useEffect(() => {
    load(rootPath);
  }, [rootPath, load]);

  const toggle = (dir: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(dir)) n.delete(dir);
      else {
        n.add(dir);
        load(dir);
      }
      return n;
    });
    onNavigate(dir);
  };

  const renderChildren = (dir: string, depth: number) => {
    const children = cache[dir] ?? [];
    if (loading.has(dir) && children.length === 0) {
      return (
        <div
          className="px-3 py-1 text-xs text-oc-text-secondary"
          style={{ paddingLeft: depth * 14 + 12 }}
        >
          Loading…
        </div>
      );
    }
    return children.map((entry) => {
      const isOpen = expanded.has(entry.path);
      if (entry.is_dir) {
        return (
          <div key={entry.path}>
            <Row
              entry={entry}
              depth={depth}
              isOpen={isOpen}
              onToggle={() => toggle(entry.path)}
              onContext={(e) => {
                e.preventDefault();
                setMenu({ path: entry.path, x: e.clientX, y: e.clientY });
              }}
            />
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  {renderChildren(entry.path, depth + 1)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      }
      return (
        <Row
          key={entry.path}
          entry={entry}
          depth={depth}
          selected={selectedFile === entry.path}
          onClick={() => onFileSelect(entry.path)}
          onDoubleClick={() => onFileSelect(entry.path)}
          onContext={(e) => {
            e.preventDefault();
            setMenu({ path: entry.path, x: e.clientX, y: e.clientY });
          }}
        />
      );
    });
  };

  return (
    <div className="relative text-sm">
      {renderChildren(rootPath, 0)}
      <AnimatePresence>
        {menu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="oc-glass fixed z-50 w-40 overflow-hidden rounded-xl p-1 shadow-2xl"
              style={{ top: menu.y, left: menu.x }}
            >
              <ContextItem
                icon={FilePen}
                label="Rename"
                onClick={() => {
                  onRequestRename(menu.path);
                  setMenu(null);
                }}
              />
              <ContextItem
                icon={Copy}
                label="Copy Path"
                onClick={() => {
                  onCopyPath(menu.path);
                  setMenu(null);
                }}
              />
              <ContextItem
                icon={Trash2}
                label="Delete"
                danger
                onClick={() => {
                  onRequestDelete(menu.path);
                  setMenu(null);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({
  entry,
  depth,
  isOpen,
  selected,
  onClick,
  onDoubleClick,
  onToggle,
  onContext,
}: {
  entry: FileEntry;
  depth: number;
  isOpen?: boolean;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onToggle?: () => void;
  onContext: (e: React.MouseEvent) => void;
}) {
  const isDir = entry.is_dir;
  return (
    <button
      type="button"
      onClick={isDir ? onToggle : onClick}
      onDoubleClick={isDir ? undefined : onDoubleClick}
      onContextMenu={onContext}
      className={cn(
        "flex w-full items-center gap-1.5 py-1 pr-2 text-left transition-colors hover:bg-oc-surface",
        selected && "bg-oc-accent/10 text-oc-accent",
      )}
      style={{ paddingLeft: depth * 14 + 8 }}
    >
      {isDir ? (
        <ChevronRight
          size={14}
          className={cn(
            "shrink-0 text-oc-text-secondary transition-transform duration-150",
            isOpen && "rotate-90",
          )}
        />
      ) : (
        <span className="w-3.5 shrink-0" />
      )}
      <FileIcon name={entry.name} isDir={isDir} isOpen={isOpen} />
      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
      {!isDir && entry.size > 0 && (
        <span className="shrink-0 text-[10px] text-oc-text-secondary">
          {formatSize(entry.size)}
        </span>
      )}
    </button>
  );
}

function ContextItem({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors",
        danger
          ? "text-red-400 hover:bg-red-500/10"
          : "text-oc-text-primary hover:bg-oc-surface",
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
