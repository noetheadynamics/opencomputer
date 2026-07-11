import { isTauri } from "./storage";
import type { FileEntry, FileMetadata, UploadFile, AuditLogEntry } from "@/types/fileSystem";

/* ------------------------------------------------------------------ */
/* Sandboxing helper (mirrors the Rust resolve_safe_path)             */
/* ------------------------------------------------------------------ */

export function resolveSafePath(root: string, path: string): string {
  const base = normalize(root);
  const target = normalize(base === "/" ? path : `${base}/${path}`);
  const baseParts = base.split("/").filter(Boolean);
  const targetParts = target.split("/").filter(Boolean);
  if (targetParts.length < baseParts.length) {
    throw new Error("Path traversal detected");
  }
  for (let i = 0; i < baseParts.length; i += 1) {
    if (targetParts[i] !== baseParts[i]) throw new Error("Path traversal detected");
  }
  return "/" + targetParts.join("/");
}

function normalize(p: string): string {
  const parts = p.split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) throw new Error("Path traversal detected");
      out.pop();
      continue;
    }
    out.push(part);
  }
  return "/" + out.join("/");
}

function parentOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Converts a path that may be absolute (starts with projectRoot) into a
 *  path relative to projectRoot, matching the Rust command semantics. */
function toRel(projectRoot: string, path: string): string {
  const r = projectRoot.replace(/\/+$/, "");
  if (path.startsWith(r)) return path.slice(r.length).replace(/^\//, "");
  return path.replace(/^\//, "");
}

/* ------------------------------------------------------------------ */
/* Browser mock filesystem (used when not running inside Tauri)       */
/* ------------------------------------------------------------------ */

interface MockNode {
  is_dir: boolean;
  content: string;
  modified: number;
}

const mockFs = new Map<string, MockNode>();
const auditLogs: AuditLogEntry[] = [];

export function getAuditLogs(): AuditLogEntry[] {
  return auditLogs;
}

function logOp(operation: string, path: string, status: "success" | "error", detail?: string) {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    operation,
    path,
    status,
    detail,
  };
  auditLogs.push(entry);
  // eslint-disable-next-line no-console
  console.log(`[audit] ${entry.operation} ${entry.status} ${entry.path}`, detail ?? "");
}

function seed(root: string) {
  if (mockFs.has(root)) return;
  const now = Date.now();
  const put = (path: string, is_dir: boolean, content = "") =>
    mockFs.set(path, { is_dir, content, modified: now });
  put(root, true);
  put(`${root}/README.md`, false, "# OpenComputer\n\nWelcome to your project.\n");
  put(
    `${root}/package.json`,
    false,
    JSON.stringify({ name: "demo-project", version: "1.0.0" }, null, 2),
  );
  put(`${root}/src`, true);
  put(
    `${root}/src/App.tsx`,
    false,
    "export default function App() {\n  return <h1>Hello</h1>;\n}\n",
  );
  put(`${root}/src/main.tsx`, false, "import App from './App';\n");
  put(`${root}/docs`, true);
  put(`${root}/docs/notes.md`, false, "## Notes\n\nPhase 2 file system.\n");
}

function mockChildren(dir: string): FileEntry[] {
  const entries: FileEntry[] = [];
  for (const [path, node] of mockFs) {
    if (parentOf(path) === dir) {
      entries.push({
        name: nameOf(path),
        path,
        is_dir: node.is_dir,
        size: node.is_dir ? 0 : node.content.length,
        modified: node.modified,
      });
    }
  }
  entries.sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

function mockCollectDescendants(dir: string, out: string[]) {
  for (const [path, node] of mockFs) {
    if (path !== dir && path.startsWith(dir + "/") && node.is_dir) {
      mockCollectDescendants(path, out);
    }
    if (path.startsWith(dir + "/")) out.push(path);
  }
}

/* ------------------------------------------------------------------ */
/* Tauri invoke wrapper                                               */
/* ------------------------------------------------------------------ */

async function tauriInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export async function listDirectory(path: string, projectRoot: string): Promise<FileEntry[]> {
  if (isTauri()) {
    try {
      const res = await tauriInvoke<FileEntry[]>("list_directory", { path, projectRoot });
      logOp("list_directory", path, "success");
      return res;
    } catch (e) {
      logOp("list_directory", path, "error", String(e));
      throw e;
    }
  }
  try {
    seed(projectRoot);
    const safe = resolveSafePath(projectRoot, toRel(projectRoot, path));
    const entries = mockChildren(safe);
    logOp("list_directory", safe, "success");
    return entries;
  } catch (e) {
    logOp("list_directory", path, "error", String(e));
    throw e;
  }
}

export async function readFile(path: string, projectRoot: string): Promise<string> {
  if (isTauri()) {
    try {
      const res = await tauriInvoke<string>("read_file", { path, projectRoot });
      logOp("read_file", path, "success");
      return res;
    } catch (e) {
      logOp("read_file", path, "error", String(e));
      throw e;
    }
  }
  try {
    seed(projectRoot);
    const safe = resolveSafePath(projectRoot, toRel(projectRoot, path));
    const node = mockFs.get(safe);
    if (!node || node.is_dir) throw new Error("File not found");
    logOp("read_file", safe, "success");
    return node.content;
  } catch (e) {
    logOp("read_file", path, "error", String(e));
    throw e;
  }
}

export async function writeFile(
  path: string,
  content: string,
  projectRoot: string,
): Promise<void> {
  if (isTauri()) {
    try {
      await tauriInvoke<void>("write_file", { path, content, projectRoot });
      logOp("write_file", path, "success");
      return;
    } catch (e) {
      logOp("write_file", path, "error", String(e));
      throw e;
    }
  }
  try {
    seed(projectRoot);
    const safe = resolveSafePath(projectRoot, toRel(projectRoot, path));
    const parent = parentOf(safe);
    if (!mockFs.has(parent)) throw new Error(`Parent directory does not exist: ${parent}`);
    const existing = mockFs.get(safe);
    mockFs.set(safe, {
      is_dir: false,
      content,
      modified: Date.now(),
    });
    if (!existing) logOp("create_file", safe, "success");
    else logOp("write_file", safe, "success");
  } catch (e) {
    logOp("write_file", path, "error", String(e));
    throw e;
  }
}

export async function createFolder(path: string, projectRoot: string): Promise<void> {
  if (isTauri()) {
    try {
      await tauriInvoke<void>("create_folder", { path, projectRoot });
      logOp("create_folder", path, "success");
      return;
    } catch (e) {
      logOp("create_folder", path, "error", String(e));
      throw e;
    }
  }
  try {
    seed(projectRoot);
    const safe = resolveSafePath(projectRoot, toRel(projectRoot, path));
    const parent = parentOf(safe);
    if (!mockFs.has(parent)) throw new Error(`Parent directory does not exist: ${parent}`);
    if (mockFs.has(safe)) throw new Error("Path already exists");
    mockFs.set(safe, { is_dir: true, content: "", modified: Date.now() });
    logOp("create_folder", safe, "success");
  } catch (e) {
    logOp("create_folder", path, "error", String(e));
    throw e;
  }
}

export async function renameFile(
  oldPath: string,
  newPath: string,
  projectRoot: string,
): Promise<void> {
  return moveFile(oldPath, newPath, projectRoot);
}

export async function moveFile(
  source: string,
  destination: string,
  projectRoot: string,
): Promise<void> {
  if (isTauri()) {
    try {
      await tauriInvoke<void>("move_file", { source, destination, projectRoot });
      logOp("move_file", `${source} -> ${destination}`, "success");
      return;
    } catch (e) {
      logOp("move_file", `${source} -> ${destination}`, "error", String(e));
      throw e;
    }
  }
  try {
    seed(projectRoot);
    const src = resolveSafePath(projectRoot, toRel(projectRoot, source));
    const dst = resolveSafePath(projectRoot, toRel(projectRoot, destination));
    if (!mockFs.has(src)) throw new Error("Source does not exist");
    const toMove = [src];
    mockCollectDescendants(src, toMove);
    const moved: Array<[string, MockNode]> = [];
    for (const p of toMove) {
      const node = mockFs.get(p)!;
      const rel = p.slice(src.length);
      moved.push([dst + rel, node]);
      mockFs.delete(p);
    }
    for (const [np, node] of moved) mockFs.set(np, node);
    logOp("move_file", `${src} -> ${dst}`, "success");
  } catch (e) {
    logOp("move_file", `${source} -> ${destination}`, "error", String(e));
    throw e;
  }
}

export async function deleteFile(path: string, projectRoot: string): Promise<void> {
  if (isTauri()) {
    try {
      await tauriInvoke<void>("delete_file", { path, projectRoot });
      logOp("delete_file", path, "success");
      return;
    } catch (e) {
      logOp("delete_file", path, "error", String(e));
      throw e;
    }
  }
  try {
    seed(projectRoot);
    const safe = resolveSafePath(projectRoot, toRel(projectRoot, path));
    if (!mockFs.has(safe)) throw new Error("Path does not exist");
    const toDelete = [safe];
    mockCollectDescendants(safe, toDelete);
    for (const p of toDelete) mockFs.delete(p);
    logOp("delete_file", safe, "success");
  } catch (e) {
    logOp("delete_file", path, "error", String(e));
    throw e;
  }
}

export async function uploadFiles(
  files: UploadFile[],
  targetDir: string,
  projectRoot: string,
): Promise<void> {
  if (isTauri()) {
    try {
      await tauriInvoke<void>("upload_files", { files, targetDir, projectRoot });
      logOp("upload_files", targetDir, "success", `${files.length} file(s)`);
      return;
    } catch (e) {
      logOp("upload_files", targetDir, "error", String(e));
      throw e;
    }
  }
  try {
    seed(projectRoot);
    const safeDir = resolveSafePath(projectRoot, toRel(projectRoot, targetDir));
    if (!mockFs.has(safeDir) || !mockFs.get(safeDir)!.is_dir) {
      throw new Error("Target directory does not exist");
    }
    for (const f of files) {
      const dest = `${safeDir}/${f.name}`;
      mockFs.set(dest, { is_dir: false, content: f.content, modified: Date.now() });
    }
    logOp("upload_files", safeDir, "success", `${files.length} file(s)`);
  } catch (e) {
    logOp("upload_files", targetDir, "error", String(e));
    throw e;
  }
}

export async function getFileMetadata(
  path: string,
  projectRoot: string,
): Promise<FileMetadata> {
  if (isTauri()) {
    try {
      const res = await tauriInvoke<FileMetadata>("get_file_metadata", { path, projectRoot });
      logOp("get_file_metadata", path, "success");
      return res;
    } catch (e) {
      logOp("get_file_metadata", path, "error", String(e));
      throw e;
    }
  }
  try {
    seed(projectRoot);
    const safe = resolveSafePath(projectRoot, toRel(projectRoot, path));
    const node = mockFs.get(safe);
    if (!node) throw new Error("Path does not exist");
    const meta: FileMetadata = {
      name: nameOf(safe),
      path: safe,
      is_dir: node.is_dir,
      size: node.is_dir ? 0 : node.content.length,
      modified: node.modified,
    };
    logOp("get_file_metadata", safe, "success");
    return meta;
  } catch (e) {
    logOp("get_file_metadata", path, "error", String(e));
    throw e;
  }
}
