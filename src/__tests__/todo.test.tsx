import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToDoPanel } from "@/components/todo/ToDoPanel";
import * as todoLib from "@/lib/todo";

describe("Phase 6 — To-Do List", () => {
  it("ToDoPanel: renders empty state", () => {
    todoLib.clearToDo();
    render(<ToDoPanel />);
    expect(screen.getByText("No items yet. Add one above.")).toBeDefined();
  });

  it("ToDoPanel: adds an item via input + Enter", () => {
    todoLib.clearToDo();
    render(<ToDoPanel />);
    const input = screen.getByPlaceholderText("Add a task...");
    fireEvent.change(input, { target: { value: "Test task" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("Test task")).toBeDefined();
    expect(screen.getByText("0/1 done")).toBeDefined();
  });

  it("ToDoPanel: toggles item checked state", () => {
    todoLib.clearToDo();
    render(<ToDoPanel />);
    const input = screen.getByPlaceholderText("Add a task...");
    fireEvent.change(input, { target: { value: "Toggle me" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // Click the checkbox area (first button in the item)
    const buttons = screen.getAllByRole("button");
    const checkboxBtn = buttons.find(
      (b) => b.closest("[class*='flex items-center gap-3']") !== null,
    );
    if (checkboxBtn) fireEvent.click(checkboxBtn);
    expect(screen.getByText("1/1 done")).toBeDefined();
  });

  it("ToDoPanel: clears all items", () => {
    todoLib.clearToDo();
    render(<ToDoPanel />);
    const input = screen.getByPlaceholderText("Add a task...");
    fireEvent.change(input, { target: { value: "Item 1" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "Item 2" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const clearBtn = screen.getByText("Clear All");
    fireEvent.click(clearBtn);
    expect(screen.getByText("No items yet. Add one above.")).toBeDefined();
  });
});
