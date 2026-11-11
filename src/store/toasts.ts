import { create } from 'zustand';

interface Toast {
  id: number;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  dismiss: (id: number) => void;
}

const TOAST_MS = 4000; // chosen
let nextId = 1;

export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: string) {
  const id = nextId++;
  useToasts.setState((s) => ({
    // De-duplicate identical messages that fire in quick succession.
    toasts: [...s.toasts.filter((t) => t.message !== message), { id, message }].slice(-3),
  }));
  setTimeout(() => useToasts.getState().dismiss(id), TOAST_MS);
}
