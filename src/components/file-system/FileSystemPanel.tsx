import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FilePlus,
  FolderPlus,
  UploadCloud,
  Search,
  X,
  Folder,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileTree } from "./FileTree";
import { FileEditor } from "./FileEditor";
import { DiffViewer } from "./DiffViewer";
import { FileUploader } from "./FileUploader";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { useFileSystem } from "@/hooks/useFileSystem";
import { listDirectory } from "@/lib/fileSystem";
import type { FileEntry, UploadFile } from "@/types/fileSystem";

interface FileSystemPanelProps {
  projectRoot: string;
  onProjectRootChange: (root: string) => void;
}

interface PendingDiff {
  filePath: string;
  originalContent: string;
  proposedContent: string;
}

interface NameModal {
  mode: "file" | "folder" | "rename" | "root";
  path?: string;
  value: string;
}

export function FileSystemPanel({
  projectRoot,
  onProjectRootChange,
}: FileSystemPanelProps) {
  const fs = useFileSystem(projectRoot);
  const [search, setSearch] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<FileEntry[] | null>(null);
  const [showUpload, setShowUpload] = React.useState(false);
  const [pendingDiff, setPendingDiff] = React.useState<PendingDiff | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);
  const [nameModal, setNameModal] = React.useState<NameModal | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const runSearch = async (q: string) => {
    setSearch(q);
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    const results: FileEntry[] = [];
    const walk = async (dir: string) => {
      const entries = await listDirectory(dir, projectRoot);
      for (const e of entries) {
        if (e.name.toLowerCase().includes(q.toLowerCase()) && !e.is_dir) {
          results.push(e);
        }
        if (e.is_dir) await walk(e.path);
      }
    };
    try {
      await walk(projectRoot);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
  };

  // Harness Slot API: harness proposes a file change -> open DiffViewer
  React.useEffect(() => {
    function onHarnessChange(ev: Event) {
      const detail = (ev as CustomEvent).detail as PendingDiff;
      if (detail?.filePath && detail.originalContent !== undefined) {
        setPendingDiff(detail);
      }
    }
    window.addEventListener("oc:harness-file-change", onHarnessChange as EventListener);
    return () =>
      window.removeEventListener(
        "oc:harness-file-change",
        onHarnessChange as EventListener,
      );
  }, []);

  const breadcrumbs = fs.currentPath.split("/").filter(Boolean);

  const confirmName = async () => {
    if (!nameModal) return;
    const value = nameModal.value.trim();
    if (!value) {
      setNameModal(null);
      return;
    }
    try {
      if (nameModal.mode === "file") await fs.createFile(value);
      else if (nameModal.mode === "folder") await fs.makeFolder(value);
      else if (nameModal.mode === "rename" && nameModal.path)
        await fs.rename(nameModal.path, value);
      else if (nameModal.mode === "root") onProjectRootChange(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setNameModal(null);
  };

  const acceptDiff = async () => {
    if (!pendingDiff) return;
    try {
      // Imported lazily to avoid a circular import at module load
      const { writeFile } = await import("@/lib/fileSystem");
      await writeFile(
        pendingDiff.filePath,
        pendingDiff.proposedContent,
        projectRoot,
      );
      if (fs.selectedFile === pendingDiff.filePath) {
        fs.selectFile(pendingDiff.filePath);
      }
      await fs.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setPendingDiff(null);
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sidebar / tree */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-oc-surface-border">
        <div className="border-b border-oc-surface-border p-3">
          <div className="flex items-center gap-1.5 text-xs text-oc-text-secondary">
            <Folder size={13} className="text-oc-accent" />
            <span className="truncate" title={projectRoot}>
              {projectRoot}
            </span>
            <button
              type="button"
              onClick={() => setNameModal({ mode: "root", value: projectRoot })}
              className="ml-auto text-oc-text-secondary hover:text-oc-accent"
              title="Change project root"
            >
              <X size={12} />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex h-8 flex-1 items-center gap-1.5 rounded-lg border border-oc-surface-border bg-oc-bg/60 px-2">
              <Search size={14} className="text-oc-text-secondary" />
              <input
                value={search}
                onChange={(e) => runSearch(e.target.value)}
                placeholder="Search files"
                className="w-full bg-transparent text-sm text-oc-text-primary outline-none placeholder:text-oc-text-secondary/60"
              />
            </div>
          </div>
          <div className="mt-2 flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setNameModal({ mode: "file", value: "" })}
            >
              <FilePlus size={14} /> File
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setNameModal({ mode: "folder", value: "" })}
            >
              <FolderPlus size={14} /> Folder
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowUpload((v) => !v)}
              title="Upload"
            >
              <UploadCloud size={14} />
            </Button>
          </div>
          {showUpload && (
            <div className="mt-2">
              <FileUploader
                onUpload={async (files: UploadFile[]) => {
                  try {
                    await fs.upload(files);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                  setShowUpload(false);
                }}
              />
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {searchResults ? (
            <div>
              {searchResults.length === 0 && (
                <p className="px-3 py-2 text-xs text-oc-text-secondary">
                  No matches
                </p>
              )}
              {searchResults.map((r) => (
                <button
                  key={r.path}
                  type="button"
                  onClick={() => {
                    fs.navigate(r.path.slice(0, r.path.lastIndexOf("/")) || "/");
                    fs.selectFile(r.path);
                    setSearchResults(null);
                    setSearch("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-oc-text-primary hover:bg-oc-surface"
                >
                  {r.name}
                </button>
              ))}
            </div>
          ) : (
            <FileTree
              rootPath={projectRoot}
              selectedFile={fs.selectedFile}
              onFileSelect={fs.selectFile}
              onNavigate={fs.navigate}
              onRequestRename={(path) =>
                setNameModal({
                  mode: "rename",
                  path,
                  value: path.slice(path.lastIndexOf("/") + 1),
                })
              }
              onRequestDelete={(path) => setDeleteTarget(path)}
              onCopyPath={(path) => navigator.clipboard?.writeText(path)}
            />
          )}
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-0.5 border-t border-oc-surface-border px-2 py-1.5 text-xs text-oc-text-secondary">
          {breadcrumbs.map((seg, i) => {
            const path = "/" + breadcrumbs.slice(0, i + 1).join("/");
            return (
              <span key={path} className="flex items-center">
                <button
                  type="button"
                  onClick={() => fs.navigate(path)}
                  className="rounded px-1 py-0.5 hover:bg-oc-surface hover:text-oc-text-primary"
                >
                  {seg}
                </button>
                {i < breadcrumbs.length - 1 && (
                  <ChevronRight size={12} className="opacity-60" />
                )}
              </span>
            );
          })}
        </div>
      </aside>

      {/* Editor / empty state */}
      <main className="min-w-0 flex-1">
        {fs.selectedFile ? (
          <FileEditor
            filePath={fs.selectedFile}
            content={fs.fileContent}
            isOpen={!!fs.selectedFile}
            onClose={fs.closeFile}
            onSave={fs.saveFile}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-oc-accent/10 text-oc-accent dark:oc-glow-sm">
              <FilePlus size={26} />
            </div>
            <p className="text-sm text-oc-text-secondary">
              Select a file to view or edit it.
            </p>
          </div>
        )}
      </main>

      {/* Name modal */}
      <NameModal
        modal={nameModal}
        onChange={(v) => setNameModal((m) => (m ? { ...m, value: v } : m))}
        onConfirm={confirmName}
        onCancel={() => setNameModal(null)}
      />

      {/* Delete confirmation */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        title="Delete this item?"
        description={`"${deleteTarget?.slice(deleteTarget.lastIndexOf("/") + 1)}" will be permanently removed. This action cannot be undone.`}
        confirmLabel="Delete"
        isDanger
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await fs.remove(deleteTarget);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 backdrop-blur"
          >
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-3 text-red-200/70 hover:text-red-100"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Diff viewer (harness-proposed changes) */}
      <DiffViewer
        isOpen={!!pendingDiff}
        filePath={pendingDiff?.filePath ?? ""}
        originalContent={pendingDiff?.originalContent ?? ""}
        proposedContent={pendingDiff?.proposedContent ?? ""}
        onAccept={acceptDiff}
        onReject={() => setPendingDiff(null)}
        onClose={() => setPendingDiff(null)}
      />
    </div>
  );
}

function NameModal({
  modal,
  onChange,
  onConfirm,
  onCancel,
}: {
  modal: NameModal | null;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!modal) return null;
  const title =
    modal.mode === "folder"
      ? "New folder"
      : modal.mode === "file"
        ? "New file"
        : modal.mode === "rename"
          ? "Rename"
          : "Project root";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="oc-glass-modal relative z-10 w-full max-w-sm p-5"
      >
        <h3 className="text-base font-semibold text-oc-text-primary">{title}</h3>
        <Input
          autoFocus
          value={modal.value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm();
            if (e.key === "Escape") onCancel();
          }}
          placeholder={modal.mode === "root" ? "/path/to/project" : "name"}
          className="mt-3"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Create</Button>
        </div>
      </motion.div>
    </div>
  );
}
