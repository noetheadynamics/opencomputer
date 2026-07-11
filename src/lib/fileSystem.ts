import { isTauri } from "./storage";
import { PHAOS_BASE } from "./config";
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

/** Converts a path that may be absolute (starts with projectRoot) into a
 *  path relative to projectRoot, matching the Rust command semantics. */
function toRel(projectRoot: string, path: string): string {
  const r = projectRoot.replace(/\/+$/, "");
  if (path.startsWith(r)) return path.slice(r.length).replace(/^\//, "");
  return path.replace(/^\//, "");
}

/* ------------------------------------------------------------------ */
/* Audit log                                                          */
/* ------------------------------------------------------------------ */

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
  console.log(`[audit] ${entry.operation} ${entry.status} ${entry.path}`, detail ?? "");
}

/* ------------------------------------------------------------------ */
/* Tauri invoke wrapper                                               */
/* ------------------------------------------------------------------ */

async function tauriInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/* ------------------------------------------------------------------ */
/* PHAOS API wrapper (browser mode)                                   */
/* ------------------------------------------------------------------ */

async function phaosGet<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${PHAOS_BASE}/api/files${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `API error ${res.status}`);
  }
  return res.json();
}

async function phaosPost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${PHAOS_BASE}/api/files${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(data.detail || `API error ${res.status}`);
  }
  return res.json();
}

async function phaosDelete(params?: Record<string, string>): Promise<void> {
  const url = new URL(`${PHAOS_BASE}/api/files`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `API error ${res.status}`);
  }
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
    const rel = toRel(projectRoot, path);
    const entries = await phaosGet<FileEntry[]>("", { path: `/${rel}` });
    logOp("list_directory", path, "success");
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
    const rel = toRel(projectRoot, path);
    const data = await phaosGet<{ content: string }>("/read", { path: `/${rel}` });
    logOp("read_file", path, "success");
    return data.content;
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
    const rel = toRel(projectRoot, path);
    await phaosPost("/write", { path: `/${rel}`, content });
    logOp("write_file", path, "success");
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
    const rel = toRel(projectRoot, path);
    await phaosPost("/mkdir", { path: `/${rel}`, content: "" });
    logOp("create_folder", path, "success");
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
    const srcRel = toRel(projectRoot, source);
    const dstRel = toRel(projectRoot, destination);
    await phaosPost("/rename", { old_path: `/${srcRel}`, new_path: `/${dstRel}` });
    logOp("move_file", `${source} -> ${destination}`, "success");
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
    const rel = toRel(projectRoot, path);
    await phaosDelete({ path: `/${rel}` });
    logOp("delete_file", path, "success");
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
    const dirRel = toRel(projectRoot, targetDir);
    for (const f of files) {
      await phaosPost("/upload", { path: `/${dirRel}`, content: f.content, name: f.name });
    }
    logOp("upload_files", targetDir, "success", `${files.length} file(s)`);
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
    const rel = toRel(projectRoot, path);
    const meta = await phaosGet<FileMetadata>("/metadata", { path: `/${rel}` });
    logOp("get_file_metadata", path, "success");
    return meta;
  } catch (e) {
    logOp("get_file_metadata", path, "error", String(e));
    throw e;
  }
}
