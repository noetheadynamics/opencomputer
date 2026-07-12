import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// CodeMirror needs a real DOM layout; mock it for jsdom stability.
vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, readOnly, onChange }: any) => (
    <textarea
      data-testid="cm"
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

import {
  resolveSafePath,
  listDirectory,
  createFolder,
  writeFile,
  readFile,
  deleteFile,
  getAuditLogs,
} from "@/lib/fileSystem";
import { DiffViewer } from "@/components/file-system/DiffViewer";
import { FileSystemPanel } from "@/components/file-system/FileSystemPanel";

const ROOT = "/OpenComputer-Phase2-Test";

describe("Phase 2 — File System", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("resolveSafePath blocks path traversal", () => {
    expect(() => resolveSafePath(ROOT, "../outside.txt")).toThrow(
      /traversal/i,
    );
    expect(() => resolveSafePath(ROOT, "a/../../etc/passwd")).toThrow(
      /traversal/i,
    );
    expect(resolveSafePath(ROOT, "src/App.tsx")).toContain("src/App.tsx");
  });

  it("listDirectory rejects traversal attempts on the wire", async () => {
    await expect(listDirectory("../.env", ROOT)).rejects.toThrow(/traversal/i);
  });

  it("CRUD: create folder, write + read file, delete; all logged", async () => {
    // Folder may persist between runs; tolerate "Already exists" error
    try {
      await createFolder("demo", ROOT);
    } catch (e: any) {
      if (!e?.message?.includes("Already exists")) throw e;
    }
    await writeFile("demo/hello.txt", "hi there", ROOT);
    const content = await readFile("demo/hello.txt", ROOT);
    expect(content).toBe("hi there");

    const list = await listDirectory(ROOT, ROOT);
    expect(list.find((e) => e.name === "demo")).toBeTruthy();

    await deleteFile("demo/hello.txt", ROOT);
    const after = await listDirectory("demo", ROOT);
    expect(after.find((e) => e.name === "hello.txt")).toBeFalsy();

    expect(getAuditLogs().length).toBeGreaterThan(0);
  });

  it("DiffViewer shows Accept/Reject and fires callbacks", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(
      <DiffViewer
        isOpen
        filePath="/x/App.tsx"
        originalContent={"a\nb\n"}
        proposedContent={"a\nc\n"}
        onAccept={onAccept}
        onReject={onReject}
        onClose={() => {}}
      />,
    );
    expect(await screen.findByText("Proposed change")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /accept/i }));
    expect(onAccept).toHaveBeenCalled();
  });

  it("FileSystemPanel: tree shows files; clicking opens editor; delete needs confirmation", async () => {
    const user = userEvent.setup();
    render(
      <FileSystemPanel
        projectRoot={ROOT}
        onProjectRootChange={() => {}}
      />,
    );

    // tree renders seeded files
    expect(await screen.findByText("README.md")).toBeInTheDocument();
    expect(screen.getByText("package.json")).toBeInTheDocument();

    // right-click -> context menu -> Delete -> confirmation dialog required
    fireEvent.contextMenu(screen.getByText("README.md"));
    const delItem = await screen.findByText("Delete");
    await user.click(delItem);
    expect(
      await screen.findByText(/Delete this item\?/i),
    ).toBeInTheDocument();
    // dismiss the confirmation so we can open the editor next
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    // open a file -> editor mounts with content
    await user.click(screen.getByText("README.md"));
    const cm = await screen.findByTestId("cm");
    expect((cm as HTMLTextAreaElement).value).toContain("# OpenComputer");
  });
});
