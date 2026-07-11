import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CronPanel } from "@/components/cron/CronPanel";
import { AuditLogPanel } from "@/components/audit-log/AuditLogPanel";
import { TaskQueuePanel } from "@/components/task-queue/TaskQueuePanel";
import { ShortcutsPanel } from "@/components/settings/ShortcutsPanel";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { SkillsLibraryPanel } from "@/components/skills/SkillsLibraryPanel";

describe("Phase 6 — Cron Panel", () => {
  it("CronPanel: renders with New button", () => {
    render(<CronPanel />);
    expect(screen.getByText("Scheduled Tasks")).toBeDefined();
    expect(screen.getByText("New")).toBeDefined();
  });

  it("CronPanel: shows form when New is clicked", () => {
    render(<CronPanel />);
    fireEvent.click(screen.getByText("New"));
    expect(screen.getByText("Create")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
  });
});

describe("Phase 6 — Audit Log Panel", () => {
  it("AuditLogPanel: renders with filter controls", () => {
    render(<AuditLogPanel />);
    expect(screen.getByText("Security Audit Log")).toBeDefined();
    expect(screen.getByText("Export CSV")).toBeDefined();
  });
});

describe("Phase 6 — Task Queue Panel", () => {
  it("TaskQueuePanel: renders empty state", () => {
    render(<TaskQueuePanel />);
    expect(screen.getByText("Task Queue")).toBeDefined();
  });
});

describe("Phase 6 — Shortcuts Panel", () => {
  it("ShortcutsPanel: renders all shortcuts", () => {
    render(<ShortcutsPanel />);
    expect(screen.getByText("Keyboard Shortcuts")).toBeDefined();
    expect(screen.getByText("Open command palette")).toBeDefined();
    expect(screen.getByText("New chat session")).toBeDefined();
    expect(screen.getByText("Send message")).toBeDefined();
    expect(screen.getByText("Toggle terminal panel")).toBeDefined();
    expect(screen.getByText("Toggle git panel")).toBeDefined();
    expect(screen.getByText("Open Settings")).toBeDefined();
    expect(screen.getByText("Toggle light/dark theme")).toBeDefined();
    expect(screen.getByText("Toggle sidebar")).toBeDefined();
    expect(screen.getByText("Close active modal/dialog")).toBeDefined();
    expect(screen.getByText("Open Security Audit Log")).toBeDefined();
  });
});

describe("Phase 6 — Notification Center", () => {
  it("NotificationCenter: renders bell icon", () => {
    render(<NotificationCenter />);
    // Bell icon should be present
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });
});

describe("Phase 6 — Skills Library Panel", () => {
  it("SkillsLibraryPanel: renders with search and import/export", () => {
    render(<SkillsLibraryPanel />);
    expect(screen.getByText("Skills Library")).toBeDefined();
    expect(screen.getByText("Export")).toBeDefined();
    expect(screen.getByText("Import")).toBeDefined();
    expect(screen.getByPlaceholderText("Search skills...")).toBeDefined();
  });
});
