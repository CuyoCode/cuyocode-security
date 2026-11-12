import { reactive } from 'vue';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

const state = reactive<ConfirmState>({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  danger: false,
  resolve: null,
});

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (state.resolve) state.resolve(false);
  state.title = options.title;
  state.message = options.message;
  state.confirmLabel = options.confirmLabel ?? 'Confirmar';
  state.cancelLabel = options.cancelLabel ?? 'Cancelar';
  state.danger = options.danger === true;
  state.open = true;
  return new Promise<boolean>((resolve) => {
    state.resolve = resolve;
  });
}

export function resolveConfirm(value: boolean): void {
  state.open = false;
  const resolver = state.resolve;
  state.resolve = null;
  resolver?.(value);
}

export function useConfirm() {
  return { state, confirmAction, resolveConfirm };
}
