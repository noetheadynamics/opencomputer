/**
 * Phase 7 Tests - Harness Management
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockActivate = vi.fn();
const mockInstall = vi.fn();
const mockUninstall = vi.fn();
const mockRefresh = vi.fn();

const mockHarnesses = [
  {
    id: 'phaos',
    name: 'PHAOS',
    version: '1.0.0',
    description: 'The default harness with AV2 amplification',
    entry_point: 'phaos.engine.orchestrator:orchestrator',
    supports_file_tools: true,
    supports_terminal: true,
    supports_git: true,
    supports_cron: true,
    status: 'active',
    metadata: {},
  },
  {
    id: 'raw',
    name: 'Raw Model',
    version: '1.0.0',
    description: 'Direct LLM calls',
    entry_point: 'raw_model:direct_call',
    supports_file_tools: false,
    supports_terminal: false,
    supports_git: false,
    supports_cron: false,
    status: 'inactive',
    metadata: {},
  },
];

vi.mock('../hooks/useHarness', () => ({
  useHarness: () => ({
    harnesses: mockHarnesses,
    activeHarnessId: 'phaos',
    loading: false,
    error: null,
    refresh: mockRefresh,
    activate: mockActivate,
    install: mockInstall,
    uninstall: mockUninstall,
  }),
}));

import { HarnessManagerPanel } from '../components/settings/HarnessManagerPanel';

describe('Phase 7 - Harness Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the harness manager panel', () => {
    render(<HarnessManagerPanel />);
    expect(screen.getByText('Harness Manager')).toBeDefined();
    expect(screen.getAllByText('PHAOS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Raw Model').length).toBeGreaterThan(0);
  });

  it('shows active harness badge', () => {
    render(<HarnessManagerPanel />);
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges.length).toBeGreaterThan(0);
  });

  it('shows harness capabilities', () => {
    render(<HarnessManagerPanel />);
    expect(screen.getAllByText('Files').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Terminal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Git').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cron').length).toBeGreaterThan(0);
  });

  it('calls activate when clicking activate button', async () => {
    render(<HarnessManagerPanel />);
    const activateButtons = screen.getAllByText('Activate');
    fireEvent.click(activateButtons[0]);
    expect(mockActivate).toHaveBeenCalledWith('raw');
  });

  it('shows refresh button', () => {
    render(<HarnessManagerPanel />);
    expect(screen.getByText('Refresh')).toBeDefined();
  });

  it('shows install custom harness button', () => {
    render(<HarnessManagerPanel />);
    expect(screen.getByText('Install Custom Harness')).toBeDefined();
  });

  it('shows harness versions', () => {
    render(<HarnessManagerPanel />);
    expect(screen.getAllByText('v1.0.0').length).toBeGreaterThan(0);
  });
});

describe('Phase 7 - Harness API mock', () => {
  it('mock functions are callable', () => {
    expect(typeof mockActivate).toBe('function');
    expect(typeof mockInstall).toBe('function');
    expect(typeof mockUninstall).toBe('function');
    expect(typeof mockRefresh).toBe('function');
  });
});
