import * as React from "react";
import {
  listDirectory,
  readFile,
  writeFile,
  createFolder,
  renameFile,
  deleteFile,
  uploadFiles,
} from "@/lib/fileSystem";
import type { FileEntry, UploadFile } from "@/types/fileSystem";

function joinPath(dir: string, name: string): string {
  if (dir.endsWith("/")) return dir + name;
  return `${dir}/${name}`;
}

function parentOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

export function useFileSystem(projectRoot: string) {
  const [currentPath, setCurrentPath] = React.useState(projectRoot);
  const [entries, setEntries] = React.useState<FileEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set([projectRoot]));

  const [selectedFile, setSelectedFile] = React.useState<string | null>(null);
  const [fileContent, setFileContent] = React.useState<string>("");
  const [fileLoading, setFileLoading] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);

  const refresh = React.useCallback(
    async (path: string = currentPath) => {
      setLoading(true);
      setError(null);
      try {
        const list = await listDirectory(path, projectRoot);
        setEntries(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [currentPath, projectRoot],
  );

  React.useEffect(() => {
    refresh(currentPath);
  }, [refresh, currentPath]);

  const navigate = React.useCallback((path: string) => {
    setCurrentPath(path);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  const toggleExpand = React.useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const selectFile = React.useCallback(
    async (path: string) => {
      setSelectedFile(path);
      setFileLoading(true);
      setFileError(null);
      try {
        const content = await readFile(path, projectRoot);
        setFileContent(content);
      } catch (e) {
        setFileError(e instanceof Error ? e.message : String(e));
      } finally {
        setFileLoading(false);
      }
    },
    [projectRoot],
  );

  const closeFile = React.useCallback(() => setSelectedFile(null), []);

  const saveFile = React.useCallback(
    async (path: string, content: string) => {
      await writeFile(path, content, projectRoot);
      setFileContent(content);
      await refresh(parentOf(path));
      // refresh parent listing so size updates
      await refresh(currentPath);
    },
    [projectRoot, currentPath, refresh],
  );

  const createFile = React.useCallback(
    async (name: string) => {
      const path = joinPath(currentPath, name);
      await writeFile(path, "", projectRoot);
      await refresh(currentPath);
      return path;
    },
    [currentPath, projectRoot, refresh],
  );

  const makeFolder = React.useCallback(
    async (name: string) => {
      const path = joinPath(currentPath, name);
      await createFolder(path, projectRoot);
      await refresh(currentPath);
    },
    [currentPath, projectRoot, refresh],
  );

  const rename = React.useCallback(
    async (path: string, newName: string) => {
      const newPath = joinPath(parentOf(path), newName);
      await renameFile(path, newPath, projectRoot);
      if (selectedFile === path) setSelectedFile(newPath);
      await refresh(currentPath);
    },
    [projectRoot, currentPath, refresh, selectedFile],
  );

  const remove = React.useCallback(
    async (path: string) => {
      await deleteFile(path, projectRoot);
      if (selectedFile === path) setSelectedFile(null);
      await refresh(currentPath);
    },
    [projectRoot, currentPath, refresh, selectedFile],
  );

  const upload = React.useCallback(
    async (files: UploadFile[]) => {
      await uploadFiles(files, currentPath, projectRoot);
      await refresh(currentPath);
    },
    [currentPath, projectRoot, refresh],
  );

  return {
    projectRoot,
    currentPath,
    entries,
    loading,
    error,
    expanded,
    selectedFile,
    fileContent,
    fileLoading,
    fileError,
    navigate,
    toggleExpand,
    refresh,
    selectFile,
    closeFile,
    saveFile,
    createFile,
    makeFolder,
    rename,
    remove,
    upload,
  };
}
