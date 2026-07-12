import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  GitStatus,
  FileStatus,
  Branch,
  CommitResult,
} from "@/types/git";

/* ------------------------------------------------------------------ */
/* In-memory mock git backend                                          */
/* ------------------------------------------------------------------ */

interface MockFile {
  content: string;
  staged: boolean;
  tracked: boolean;
  status: "added" | "modified" | "deleted" | "renamed" | "untracked";
}

interface MockBranch {
  name: string;
  current: boolean;
}

interface MockRepo {
  files: Map<string, MockFile>;
  branches: MockBranch[];
  currentBranch: string;
  commits: Array<{ hash: string; message: string; files: string[] }>;
}

let _repo: MockRepo = {
  files: new Map([
    ["src/main.ts", { content: "console.log('hello')", staged: false, tracked: true, status: "modified" }],
    ["src/utils.ts", { content: "export const x = 1", staged: false, tracked: true, status: "modified" }],
    ["README.md", { content: "# OpenComputer", staged: false, tracked: true, status: "modified" }],
  ]),
  branches: [
    { name: "main", current: true },
    { name: "feature/ui", current: false },
  ],
  currentBranch: "main",
  commits: [],
};

function resetMockRepo(): void {
  _repo = {
    files: new Map([
      ["src/main.ts", { content: "console.log('hello')", staged: false, tracked: true, status: "modified" }],
      ["src/utils.ts", { content: "export const x = 1", staged: false, tracked: true, status: "modified" }],
      ["README.md", { content: "# OpenComputer", staged: false, tracked: true, status: "modified" }],
    ]),
    branches: [
      { name: "main", current: true },
      { name: "feature/ui", current: false },
    ],
    currentBranch: "main",
    commits: [],
  };
}

function mockGitStatus(): GitStatus {
  const staged: FileStatus[] = [];
  const unstaged: FileStatus[] = [];
  const untracked: FileStatus[] = [];

  for (const [path, file] of _repo.files) {
    if (!file.tracked && !file.staged) {
      untracked.push({ path, status: "untracked", staged: false });
    } else if (file.staged) {
      staged.push({ path, status: file.status, staged: true });
    } else if (file.status === "modified") {
      unstaged.push({ path, status: "modified", staged: false });
    }
  }

  return {
    branch: _repo.currentBranch,
    staged,
    unstaged,
    untracked,
    ahead: 0,
    behind: 0,
    isRepo: true,
  };
}

/* ------------------------------------------------------------------ */
/* Mock the git module                                                 */
/* ------------------------------------------------------------------ */

vi.mock("@/lib/git", () => ({
  getStatus: vi.fn(async () => mockGitStatus()),
  stageFiles: vi.fn(async (files: string[]) => {
    if (files.length === 0) {
      for (const [, file] of _repo.files) {
        if (file.tracked && !file.staged) file.staged = true;
      }
    } else {
      for (const path of files) {
        const file = _repo.files.get(path);
        if (file) file.staged = true;
      }
    }
  }),
  unstageFiles: vi.fn(async (files: string[]) => {
    for (const path of files) {
      const file = _repo.files.get(path);
      if (file) file.staged = false;
    }
  }),
  commitChanges: vi.fn(async (message: string) => {
    const hash = Array.from({ length: 7 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const committedFiles: string[] = [];
    for (const [path, file] of _repo.files) {
      if (file.staged) {
        file.tracked = true;
        file.staged = false;
        file.status = "modified";
        committedFiles.push(path);
      }
    }
    _repo.commits.push({ hash, message, files: committedFiles });
    return { hash, message };
  }),
  pushChanges: vi.fn(async () => `Pushed to origin/${_repo.currentBranch}`),
  pullChanges: vi.fn(async () => `Pulled from origin/${_repo.currentBranch}`),
  getBranches: vi.fn(async () =>
    _repo.branches.map((b) => ({ name: b.name, current: b.current })),
  ),
  createBranch: vi.fn(async (name: string) => {
    if (_repo.branches.some((b) => b.name === name)) {
      throw new Error(`Branch '${name}' already exists`);
    }
    _repo.branches.push({ name, current: false });
  }),
  switchBranch: vi.fn(async (name: string) => {
    const branch = _repo.branches.find((b) => b.name === name);
    if (!branch) throw new Error(`Branch '${name}' not found`);
    _repo.branches.forEach((b) => (b.current = b.name === name));
    _repo.currentBranch = name;
  }),
  deleteBranch: vi.fn(async (name: string) => {
    if (name === _repo.currentBranch) throw new Error("Cannot delete the current branch");
    const idx = _repo.branches.findIndex((b) => b.name === name);
    if (idx === -1) throw new Error(`Branch '${name}' not found`);
    _repo.branches.splice(idx, 1);
  }),
  getFileDiff: vi.fn(async (filePath: string) => {
    const file = _repo.files.get(filePath);
    return { filePath, diff: file ? `diff --git a/${filePath} b/${filePath}\n${file.content}` : "" };
  }),
}));

import {
  getStatus,
  stageFiles,
  unstageFiles,
  commitChanges,
  getBranches,
  createBranch,
  switchBranch,
  deleteBranch,
} from "@/lib/git";
import { StatusView } from "@/components/git/StatusView";
import { GitPanel } from "@/components/git/GitPanel";
import { GitConfirmationDialog } from "@/components/git/GitConfirmationDialog";
import { BranchManager } from "@/components/git/BranchManager";

describe("Phase 4 — Git", () => {
  beforeEach(() => {
    localStorage.clear();
    resetMockRepo();
    vi.restoreAllMocks();
  });

  it("getStatus: returns initial repo status", async () => {
    const status = await getStatus("/mock");
    expect(status.isRepo).toBe(true);
    expect(status.branch).toBe("main");
    expect(status.staged.length + status.unstaged.length + status.untracked.length).toBeGreaterThan(0);
  });

  it("stageFiles: stages a specific file", async () => {
    await stageFiles(["src/main.ts"], "/mock");
    const status = await getStatus("/mock");
    expect(status.staged.some((f) => f.path === "src/main.ts")).toBe(true);
    expect(status.unstaged.some((f) => f.path === "src/main.ts")).toBe(false);
  });

  it("stageFiles: stages all when empty array", async () => {
    await stageFiles([], "/mock");
    const status = await getStatus("/mock");
    expect(status.staged.length).toBeGreaterThan(0);
  });

  it("unstageFiles: unstages a staged file", async () => {
    await stageFiles(["src/main.ts"], "/mock");
    await unstageFiles(["src/main.ts"], "/mock");
    const status = await getStatus("/mock");
    expect(status.staged.some((f) => f.path === "src/main.ts")).toBe(false);
  });

  it("commitChanges: commits staged files and returns hash", async () => {
    await stageFiles(["src/main.ts"], "/mock");
    const result = await commitChanges("Test commit", "/mock");
    expect(result.hash).toBeTruthy();
    expect(result.message).toBe("Test commit");
    const status = await getStatus("/mock");
    expect(status.staged.some((f) => f.path === "src/main.ts")).toBe(false);
  });

  it("getBranches: returns branches with current marked", async () => {
    const branches = await getBranches("/mock");
    expect(branches.length).toBeGreaterThanOrEqual(2);
    const current = branches.find((b) => b.current);
    expect(current?.name).toBe("main");
  });

  it("createBranch: adds a new branch", async () => {
    await createBranch("feature/test", "/mock");
    const branches = await getBranches("/mock");
    expect(branches.some((b) => b.name === "feature/test")).toBe(true);
  });

  it("switchBranch: changes current branch", async () => {
    await switchBranch("feature/ui", "/mock");
    const branches = await getBranches("/mock");
    const current = branches.find((b) => b.current);
    expect(current?.name).toBe("feature/ui");
  });

  it("deleteBranch: removes a non-current branch", async () => {
    await deleteBranch("feature/ui", "/mock");
    const branches = await getBranches("/mock");
    expect(branches.some((b) => b.name === "feature/ui")).toBe(false);
  });

  it("deleteBranch: cannot delete current branch", async () => {
    await expect(deleteBranch("main", "/mock")).rejects.toThrow(
      "Cannot delete the current branch",
    );
  });

  it("StatusView: renders staged, unstaged, untracked sections", () => {
    const status: GitStatus = {
      branch: "main",
      staged: [{ path: "a.ts", status: "modified", staged: true }],
      unstaged: [{ path: "b.ts", status: "modified", staged: false }],
      untracked: [{ path: "c.txt", status: "untracked", staged: false }],
      ahead: 0,
      behind: 0,
      isRepo: true,
    };
    render(
      <StatusView
        staged={status.staged}
        unstaged={status.unstaged}
        untracked={status.untracked}
        onStageFile={() => {}}
        onUnstageFile={() => {}}
        onStageAll={() => {}}
        onUnstageAll={() => {}}
        onViewDiff={() => {}}
      />,
    );
    expect(screen.getByText("Staged Changes (1)")).toBeInTheDocument();
    expect(screen.getByText("Unstaged Changes (1)")).toBeInTheDocument();
    expect(screen.getByText("Untracked Files (1)")).toBeInTheDocument();
    expect(screen.getByText("a.ts")).toBeInTheDocument();
    expect(screen.getByText("b.ts")).toBeInTheDocument();
    expect(screen.getByText("c.txt")).toBeInTheDocument();
  });

  it("StatusView: shows clean working tree when empty", () => {
    render(
      <StatusView
        staged={[]}
        unstaged={[]}
        untracked={[]}
        onStageFile={() => {}}
        onUnstageFile={() => {}}
        onStageAll={() => {}}
        onUnstageAll={() => {}}
        onViewDiff={() => {}}
      />,
    );
    expect(screen.getByText("Working tree clean")).toBeInTheDocument();
  });

  it("GitConfirmationDialog: shows title and message, fires callbacks", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <GitConfirmationDialog
        isOpen
        title="Push to Remote"
        message="This will push 1 commit."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText("Push to Remote")).toBeInTheDocument();
    expect(screen.getByText("This will push 1 commit.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("GitPanel: renders with Git header and branch info", async () => {
    render(<GitPanel projectRoot="/mock" />);
    expect(await screen.findByText("Git")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("main").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("GitPanel: shows files in status view after load", async () => {
    render(<GitPanel projectRoot="/mock" />);
    await waitFor(() => {
      expect(screen.getByText("src/main.ts")).toBeInTheDocument();
    });
  });

  it("BranchManager: creates a branch via input", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(
      <BranchManager
        branches={[
          { name: "main", current: true },
          { name: "dev", current: false },
        ]}
        currentBranch="main"
        onCreateBranch={onCreate}
        onSwitchBranch={() => {}}
        onDeleteBranch={() => {}}
        uncommittedChanges={false}
      />,
    );

    const input = screen.getByPlaceholderText("New branch name…");
    await user.type(input, "feature-x");
    await user.click(screen.getByRole("button", { name: /create/i }));
    expect(onCreate).toHaveBeenCalledWith("feature-x");
  });
});
