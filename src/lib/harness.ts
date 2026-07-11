/**
 * Harness management API for OpenComputer.
 */

import type {
  Harness,
  HarnessListResponse,
  HarnessStatusResponse,
  HarnessInstallRequest,
  HarnessActivateRequest,
} from '../types/harness';
import { PHAOS_BASE } from './config';

/**
 * Get a harness connection for AI-assisted features.
 */
export function getHarnessConnection() {
  return {
    suggestCommitMessage: async (files: string[]): Promise<string> => {
      return `Update ${files.length} file(s)`;
    },
  };
}

/**
 * List all installed harnesses.
 */
export async function listHarnesses(): Promise<HarnessListResponse> {
  const res = await fetch(`${PHAOS_BASE}/api/harness/manage/list`);
  if (!res.ok) {
    throw new Error(`Failed to list harnesses: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Get the currently active harness.
 */
export async function getActiveHarness(): Promise<Harness> {
  const res = await fetch(`${PHAOS_BASE}/api/harness/manage/active`);
  if (!res.ok) {
    throw new Error(`Failed to get active harness: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Activate a harness.
 */
export async function activateHarness(request: HarnessActivateRequest): Promise<void> {
  const res = await fetch(`${PHAOS_BASE}/api/harness/manage/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(`Failed to activate harness: ${res.statusText}`);
  }
}

/**
 * Install a custom harness.
 */
export async function installHarness(request: HarnessInstallRequest): Promise<Harness> {
  const res = await fetch(`${PHAOS_BASE}/api/harness/manage/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(`Failed to install harness: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Uninstall a harness.
 */
export async function uninstallHarness(harnessId: string): Promise<void> {
  const res = await fetch(`${PHAOS_BASE}/api/harness/manage/${harnessId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to uninstall harness: ${res.statusText}`);
  }
}

/**
 * Get harness status.
 */
export async function getHarnessStatus(): Promise<HarnessStatusResponse> {
  const res = await fetch(`${PHAOS_BASE}/api/harness/manage/status`);
  if (!res.ok) {
    throw new Error(`Failed to get harness status: ${res.statusText}`);
  }
  return res.json();
}
