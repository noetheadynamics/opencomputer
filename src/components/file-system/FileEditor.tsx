import * as React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { Save, X, WrapText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { languageForPath } from "@/types/fileSystem";
import { cn } from "@/lib/utils";
import { useIsDark } from "@/hooks/useIsDark";

interface FileEditorProps {
  filePath: string;
  content: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (path: string, content: string) => void;
  readOnly?: boolean;
}

export function FileEditor({
  filePath,
  content,
  isOpen,
  onClose,
  onSave,
  readOnly = false,
}: FileEditorProps) {
  const [draft, setDraft] = React.useState(content);
  const [dirty, setDirty] = React.useState(false);
  const [wrap, setWrap] = React.useState(true);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const isDark = useIsDark();

  React.useEffect(() => {
    setDraft(content);
    setDirty(false);
  }, [filePath, content, isOpen]);

  const lang = languageForPath(filePath);
  const langSupport = React.useMemo(
    () =>
      languages.find(
        (l) =>
          l.name.toLowerCase() === lang ||
          (l.alias ?? []).includes(lang),
      ) ?? null,
    [lang],
  );

  const extensions = React.useMemo(
    () => [wrap ? EditorView.lineWrapping : []].flat(),
    [wrap],
  );

  if (!isOpen) return null;

  const tryClose = () => {
    if (dirty) setConfirmClose(true);
    else onClose();
  };

  const doSave = () => {
    onSave(filePath, draft);
    setDirty(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-oc-surface-border px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-oc-text-primary">
            {filePath.slice(filePath.lastIndexOf("/") + 1)}
          </span>
          {dirty && (
            <span className="h-2 w-2 rounded-full bg-oc-accent" title="Unsaved changes" />
          )}
          {readOnly && (
            <span className="flex items-center gap-1 text-xs text-oc-text-secondary">
              <Lock size={12} /> read-only
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWrap((w) => !w)}
            title="Toggle word wrap"
            className={cn(
              "rounded-lg p-1.5 transition-colors hover:bg-oc-surface",
              wrap ? "text-oc-accent" : "text-oc-text-secondary",
            )}
          >
            <WrapText size={16} />
          </button>
          {!readOnly && (
            <Button size="sm" onClick={doSave} disabled={!dirty}>
              <Save size={14} /> Save
            </Button>
          )}
          <button
            type="button"
            onClick={tryClose}
            className="rounded-lg p-1.5 text-oc-text-secondary transition-colors hover:bg-oc-surface hover:text-oc-text-primary"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeMirror
          value={draft}
          height="100%"
          theme={isDark ? "dark" : "light"}
          editable={!readOnly}
          readOnly={readOnly}
          extensions={[...(langSupport?.support ? [langSupport.support as Extension] : []), ...extensions]}
          onChange={(val) => {
            setDraft(val);
            setDirty(val !== content);
          }}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: !readOnly,
            foldGutter: true,
          }}
          style={{ height: "100%", fontSize: 13 }}
        />
      </div>

      <ConfirmationDialog
        isOpen={confirmClose}
        title="Discard unsaved changes?"
        description="You have unsaved changes in this file. Closing now will discard them."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        isDanger
        onConfirm={() => {
          setConfirmClose(false);
          onClose();
        }}
        onCancel={() => setConfirmClose(false)}
      />
    </div>
  );
}
