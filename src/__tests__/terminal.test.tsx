import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { classifyRisk, executeCommand, requiresConfirmation } from "@/lib/terminal";
import { RiskConfirmationDialog } from "@/components/terminal/RiskConfirmationDialog";
import { TerminalPanel } from "@/components/terminal/TerminalPanel";

describe("Phase 3 — Terminal", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("classifyRisk: network commands are HIGH risk", () => {
    expect(classifyRisk("curl http://example.com").level).toBe("high");
    expect(classifyRisk("wget http://example.com/file").level).toBe("high");
    expect(classifyRisk("nc -l 8080").level).toBe("high");
    expect(classifyRisk("telnet host").level).toBe("high");
    expect(classifyRisk("ssh user@host").level).toBe("high");
  });

  it("classifyRisk: dangerous patterns are HIGH risk", () => {
    expect(classifyRisk("rm -rf /").level).toBe("high");
    expect(classifyRisk("sudo rm -rf /").level).toBe("high");
    expect(classifyRisk("chmod 777 file").level).toBe("high");
    expect(classifyRisk("shutdown -h now").level).toBe("high");
  });

  it("classifyRisk: moderate commands are MEDIUM risk", () => {
    expect(classifyRisk("rm file.txt").level).toBe("medium");
    expect(classifyRisk("mv a b").level).toBe("medium");
    expect(classifyRisk("chmod +x script.sh").level).toBe("medium");
  });

  it("classifyRisk: safe commands are LOW risk", () => {
    expect(classifyRisk("ls -la").level).toBe("low");
    expect(classifyRisk("cat file.txt").level).toBe("low");
    expect(classifyRisk("echo hello").level).toBe("low");
  });

  it("requiresConfirmation: only HIGH risk requires confirmation", () => {
    expect(requiresConfirmation({ level: "high", reason: "test" })).toBe(true);
    expect(requiresConfirmation({ level: "medium", reason: "test" })).toBe(false);
    expect(requiresConfirmation({ level: "low", reason: "test" })).toBe(false);
  });

  it("executeCommand: safe commands return mock output", async () => {
    const result = await executeCommand("echo hello", "/test");
    expect(result.stdout).toBe("hello");
    expect(result.exit_code).toBe(0);
  });

  it("executeCommand: unknown commands return exit code 127", async () => {
    const result = await executeCommand("nonexistentcmd", "/test");
    expect(result.exit_code).toBe(127);
    expect(result.stderr).toContain("Command not found");
  });

  it("RiskConfirmationDialog: shows and fires callbacks", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { unmount } = render(
      <RiskConfirmationDialog
        risk={{ level: "high", reason: "Network command" }}
        command="curl http://evil.com"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(await screen.findByText("Confirm High-Risk Command")).toBeInTheDocument();
    expect(screen.getByText("curl http://evil.com")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();

    unmount();

    // Re-render to test confirm
    const { unmount: unmount2 } = render(
      <RiskConfirmationDialog
        risk={{ level: "high", reason: "Network command" }}
        command="curl http://evil.com"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole("button", { name: /execute anyway/i }));
    expect(onConfirm).toHaveBeenCalled();
    unmount2();
  });

  it("TerminalPanel: renders welcome message and executes command", async () => {
    const user = userEvent.setup();
    render(<TerminalPanel projectRoot="/test" />);
    expect(await screen.findByText("Terminal")).toBeInTheDocument();
    expect(screen.getByText(/Welcome to OpenComputer Terminal/)).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Type a command...");
    await user.type(input, "echo hello world");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("$ echo hello world")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("hello world")).toBeInTheDocument();
    });
  });

  it("TerminalPanel: high-risk command opens confirmation dialog", async () => {
    const user = userEvent.setup();
    render(<TerminalPanel projectRoot="/test" />);
    await screen.findByText("Terminal");

    const input = screen.getByPlaceholderText("Type a command...");
    await user.type(input, "curl http://example.com");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("Confirm High-Risk Command")).toBeInTheDocument();
    });
    expect(screen.getByText("curl http://example.com")).toBeInTheDocument();
  });
});
