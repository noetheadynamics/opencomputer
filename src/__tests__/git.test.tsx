import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  getStatus,
  stageFiles,
  unstageFiles,
  commitChanges,
  getBranches,
  createBranch,
  switchBranch,
  deleteBranch,
  resetMockGit,
} from "@/lib/git";
import { StatusView } from "@/components/git/StatusView";
import { GitPanel } from "@/components/git/GitPanel";
import { GitConfirmationDialog } from "@/components/git/GitConfirmationDialog";
import { BranchManager } from "@/components/git/BranchManager";
import type { GitStatus } from "@/types/git";

describe("Phase 4 — Git", () => {
  beforeEach(() => {
    localStorage.clear();
    resetMockGit();
    vi.restoreAllMocks();
  });

  it("getStatus: returns initial mock repo status", async () => {
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
    // Should show branch badge (branch name appears in multiple places)
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
