import type { ToDoItem } from "@/types/todo";

let _items: ToDoItem[] = [];
let _sessionId = crypto.randomUUID().slice(0, 8);

export function getToDoItems(): ToDoItem[] {
  return [..._items];
}

export function addToDo(text: string): ToDoItem {
  const item: ToDoItem = {
    id: crypto.randomUUID().slice(0, 8),
    text,
    checked: false,
    createdAt: Date.now(),
  };
  _items.push(item);
  return item;
}

export function toggleToDo(id: string): ToDoItem | null {
  const item = _items.find((i) => i.id === id);
  if (item) item.checked = !item.checked;
  return item ?? null;
}

export function removeToDo(id: string): boolean {
  const len = _items.length;
  _items = _items.filter((i) => i.id !== id);
  return _items.length < len;
}

export function clearToDo(): void {
  _items = [];
  _sessionId = crypto.randomUUID().slice(0, 8);
}

export function getSessionId(): string {
  return _sessionId;
}
