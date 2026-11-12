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
const MAX_VISIBLE = 3;
let nextId = 1;
const timers = new Map<number, number>();

export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  dismiss: (id) => {
    window.clearTimeout(timers.get(id));
    timers.delete(id);
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

function schedule(id: number) {
  window.clearTimeout(timers.get(id));
  timers.set(
    id,
    window.setTimeout(() => useToasts.getState().dismiss(id), TOAST_MS),
  );
}

/**
 * Shows a short message. If the same text is already on screen it isn't shown twice; the
 * existing toast just stays up a little longer.
 */
export function toast(message: string) {
  const existing = useToasts.getState().toasts.find((t) => t.message === message);
  if (existing) {
    schedule(existing.id);
    return;
  }
  const id = nextId++;
  useToasts.setState((s) => {
    const toasts = [...s.toasts, { id, message }];
    // Drop the oldest beyond the limit (and its timer).
    while (toasts.length > MAX_VISIBLE) {
      const old = toasts.shift()!;
      window.clearTimeout(timers.get(old.id));
      timers.delete(old.id);
    }
    return { toasts };
  });
  schedule(id);
}
