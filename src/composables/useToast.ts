import { reactive, readonly } from 'vue';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

let nextId = 1;
const items = reactive<Toast[]>([]);
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function dismiss(id: number): void {
  const index = items.findIndex((t) => t.id === id);
  if (index >= 0) items.splice(index, 1);
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
}

function push(kind: ToastKind, title: string, detail?: string, ttlMs = 5000): number {
  const id = nextId++;
  items.push({ id, kind, title, ...(detail ? { detail } : {}) });
  if (ttlMs > 0) {
    timers.set(id, setTimeout(() => dismiss(id), ttlMs));
  }
  return id;
}

export const toast = {
  success: (title: string, detail?: string) => push('success', title, detail),
  error: (title: string, detail?: string) => push('error', title, detail, 8000),
  info: (title: string, detail?: string) => push('info', title, detail),
  warning: (title: string, detail?: string) => push('warning', title, detail, 7000),
  dismiss,
};

export function useToast() {
  return { toasts: readonly(items), toast, dismiss };
}
