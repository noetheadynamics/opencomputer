import {
  FileCode,
  FileJson,
  FileText,
  FileType,
  FileImage,
  Settings,
  Hash,
  Folder,
  FolderOpen,
  type LucideIcon,
} from "lucide-react";

const EXT_ICONS: Record<string, LucideIcon> = {
  js: FileCode,
  jsx: FileCode,
  mjs: FileCode,
  cjs: FileCode,
  ts: FileCode,
  tsx: FileCode,
  py: FileCode,
  json: FileJson,
  md: FileText,
  markdown: FileText,
  html: FileType,
  htm: FileType,
  css: FileType,
  scss: FileType,
  less: FileType,
  rs: Hash,
  yaml: Settings,
  yml: Settings,
  toml: Settings,
  env: Settings,
  gitignore: Settings,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  gif: FileImage,
  svg: FileImage,
  webp: FileImage,
};

export function FileIcon({
  name,
  isDir,
  isOpen,
  size = 16,
}: {
  name: string;
  isDir: boolean;
  isOpen?: boolean;
  size?: number;
}) {
  if (isDir) {
    const Icon = isOpen ? FolderOpen : Folder;
    return <Icon size={size} className="text-oc-accent" />;
  }
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  const Icon = EXT_ICONS[ext] ?? FileText;
  return <Icon size={size} className="text-oc-text-secondary" />;
}
