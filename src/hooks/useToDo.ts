import { useState, useCallback } from "react";
import type { ToDoItem } from "@/types/todo";
import * as todoLib from "@/lib/todo";

export function useToDo() {
  const [items, setItems] = useState<ToDoItem[]>(() => todoLib.getToDoItems());

  const add = useCallback((text: string) => {
    const item = todoLib.addToDo(text);
    setItems([...todoLib.getToDoItems()]);
    return item;
  }, []);

  const toggle = useCallback((id: string) => {
    todoLib.toggleToDo(id);
    setItems([...todoLib.getToDoItems()]);
  }, []);

  const remove = useCallback((id: string) => {
    todoLib.removeToDo(id);
    setItems([...todoLib.getToDoItems()]);
  }, []);

  const clear = useCallback(() => {
    todoLib.clearToDo();
    setItems([]);
  }, []);

  return { items, add, toggle, remove, clear, sessionId: todoLib.getSessionId() };
}
