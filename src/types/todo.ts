export interface ToDoItem {
  id: string;
  text: string;
  checked: boolean;
  createdAt: number;
}

export interface ToDoState {
  items: ToDoItem[];
  sessionId: string;
}
