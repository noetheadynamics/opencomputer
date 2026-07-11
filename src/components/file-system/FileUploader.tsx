import * as React from "react";
import { motion } from "framer-motion";
import { UploadCloud } from "lucide-react";
import type { UploadFile } from "@/types/fileSystem";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  onUpload: (files: UploadFile[]) => void;
  className?: string;
}

export function FileUploader({ onUpload, className }: FileUploaderProps) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const readFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files: UploadFile[] = [];
    for (const file of Array.from(fileList)) {
      const content = await file.text();
      files.push({ name: file.name, content });
    }
    onUpload(files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        readFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
        dragging
          ? "border-oc-accent bg-oc-accent/10 dark:oc-glow-sm"
          : "border-oc-surface-border hover:border-oc-accent/60",
        className,
      )}
    >
      <motion.div
        animate={{ y: dragging ? -4 : 0 }}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-oc-accent/10 text-oc-accent"
      >
        <UploadCloud size={20} />
      </motion.div>
      <p className="text-xs text-oc-text-secondary">
        {dragging ? "Drop to upload" : "Drag & drop files here, or click to browse"}
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          readFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
