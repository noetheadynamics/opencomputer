import * as React from "react";
import {
  getStatus,
  stageFiles,
  unstageFiles,
  commitChanges,
  pushChanges,
  pullChanges,
  getBranches,
  createBranch,
  switchBranch,
  deleteBranch,
  getFileDiff,
} from "@/lib/git";
import type { GitStatus, Branch, CommitResult, DiffResult } from "@/types/git";

interface GitState {
  status: GitStatus;
  branches: Branch[];
  loading: boolean;
  error: string | null;
  pushing: boolean;
  pulling: boolean;
  committing: boolean;
  diffResult: DiffResult | null;
}

const EMPTY_STATUS: GitStatus = {
  branch: "",
  staged: [],
  unstaged: [],
  untracked: [],
  ahead: 0,
  behind: 0,
  isRepo: false,
};

interface UseGitReturn {
  status: GitStatus;
  branches: Branch[];
  loading: boolean;
  error: string | null;
  pushing: boolean;
  pulling: boolean;
  committing: boolean;
  diffResult: DiffResult | null;
  refresh: () => Promise<void>;
  stage: (files: string[]) => Promise<void>;
  unstage: (files: string[]) => Promise<void>;
  stageAll: () => Promise<void>;
  unstageAll: () => Promise<void>;
  commit: (message: string) => Promise<CommitResult>;
  push: () => Promise<string>;
  pull: () => Promise<string>;
  createBranch: (name: string) => Promise<void>;
  switchBranch: (name: string) => Promise<void>;
  deleteBranch: (name: string) => Promise<void>;
  viewDiff: (filePath: string) => Promise<void>;
  clearDiff: () => void;
}

export function useGit(projectRoot: string): UseGitReturn {
  const [state, setState] = React.useState<GitState>({
    status: EMPTY_STATUS,
    branches: [],
    loading: false,
    error: null,
    pushing: false,
    pulling: false,
    committing: false,
    diffResult: null,
  });

  const refresh = React.useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [status, branches] = await Promise.all([
        getStatus(projectRoot),
        getBranches(projectRoot),
      ]);
      setState((prev) => ({
        ...prev,
        status,
        branches,
        loading: false,
      }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, [projectRoot]);

  const stage = React.useCallback(
    async (files: string[]) => {
      try {
        await stageFiles(files, projectRoot);
        await refresh();
      } catch (e) {
        setState((prev) => ({
          ...prev,
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    },
    [projectRoot, refresh],
  );

  const unstage = React.useCallback(
    async (files: string[]) => {
      try {
        await unstageFiles(files, projectRoot);
        await refresh();
      } catch (e) {
        setState((prev) => ({
          ...prev,
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    },
    [projectRoot, refresh],
  );

  const stageAll = React.useCallback(async () => {
    try {
      await stageFiles([], projectRoot);
      await refresh();
    } catch (e) {
      setState((prev) => ({
        ...prev,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, [projectRoot, refresh]);

  const unstageAll = React.useCallback(async () => {
    const staged = state.status.staged.map((f) => f.path);
    if (staged.length > 0) {
      await unstage(staged);
    }
  }, [state.status.staged, unstage]);

  const commit = React.useCallback(
    async (message: string): Promise<CommitResult> => {
      setState((prev) => ({ ...prev, committing: true, error: null }));
      try {
        const result = await commitChanges(message, projectRoot);
        await refresh();
        setState((prev) => ({ ...prev, committing: false }));
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setState((prev) => ({ ...prev, committing: false, error: msg }));
        throw e;
      }
    },
    [projectRoot, refresh],
  );

  const push = React.useCallback(async (): Promise<string> => {
    setState((prev) => ({ ...prev, pushing: true, error: null }));
    try {
      const msg = await pushChanges(projectRoot);
      setState((prev) => ({ ...prev, pushing: false }));
      return msg;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState((prev) => ({ ...prev, pushing: false, error: msg }));
      throw e;
    }
  }, [projectRoot]);

  const pull = React.useCallback(async (): Promise<string> => {
    setState((prev) => ({ ...prev, pulling: true, error: null }));
    try {
      const msg = await pullChanges(projectRoot);
      setState((prev) => ({ ...prev, pulling: false }));
      return msg;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState((prev) => ({ ...prev, pulling: false, error: msg }));
      throw e;
    }
  }, [projectRoot]);

  const handleCreateBranch = React.useCallback(
    async (name: string) => {
      try {
        await createBranch(name, projectRoot);
        await refresh();
      } catch (e) {
        setState((prev) => ({
          ...prev,
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    },
    [projectRoot, refresh],
  );

  const handleSwitchBranch = React.useCallback(
    async (name: string) => {
      try {
        await switchBranch(name, projectRoot);
        await refresh();
      } catch (e) {
        setState((prev) => ({
          ...prev,
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    },
    [projectRoot, refresh],
  );

  const handleDeleteBranch = React.useCallback(
    async (name: string) => {
      try {
        await deleteBranch(name, projectRoot);
        await refresh();
      } catch (e) {
        setState((prev) => ({
          ...prev,
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    },
    [projectRoot, refresh],
  );

  const viewDiff = React.useCallback(
    async (filePath: string) => {
      try {
        const result = await getFileDiff(filePath, projectRoot);
        setState((prev) => ({ ...prev, diffResult: result }));
      } catch (e) {
        setState((prev) => ({
          ...prev,
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    },
    [projectRoot],
  );

  const clearDiff = React.useCallback(() => {
    setState((prev) => ({ ...prev, diffResult: null }));
  }, []);

  // Load on mount
  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    status: state.status,
    branches: state.branches,
    loading: state.loading,
    error: state.error,
    pushing: state.pushing,
    pulling: state.pulling,
    committing: state.committing,
    diffResult: state.diffResult,
    refresh,
    stage,
    unstage,
    stageAll,
    unstageAll,
    commit,
    push,
    pull,
    createBranch: handleCreateBranch,
    switchBranch: handleSwitchBranch,
    deleteBranch: handleDeleteBranch,
    viewDiff,
    clearDiff,
  };
}
