export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  /** Last-modified time in epoch milliseconds */
  modified: number;
}

export interface FileMetadata {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
}

export interface UploadFile {
  name: string;
  /** File contents as a UTF-8 string (binary files are not supported in Phase 2) */
  content: string;
}

export interface AuditLogEntry {
  timestamp: string;
  operation: string;
  path: string;
  status: "success" | "error";
  detail?: string;
}

/** Maps a file extension to a CodeMirror language id used by language-data. */
export function languageForPath(path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const map: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    mjs: "javascript",
    cjs: "javascript",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    json: "json",
    md: "markdown",
    markdown: "markdown",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    rs: "rust",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    xml: "xml",
    sql: "sql",
    sh: "shell",
    bash: "shell",
  };
  return map[ext] ?? "text";
}
