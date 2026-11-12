import { ref } from 'vue';
import { toast } from './useToast';

export interface AsyncActionOptions {
  errorMessage?: string;
  successMessage?: string;
}

/** Ejecuta una acción async con estado de carga y errores visibles. */
export function useAsyncAction() {
  const loading = ref(false);
  const error = ref('');

  async function run<T>(fn: () => Promise<T>, options: AsyncActionOptions = {}): Promise<T | undefined> {
    loading.value = true;
    error.value = '';
    try {
      const result = await fn();
      if (options.successMessage) toast.success(options.successMessage);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : (options.errorMessage ?? 'Ocurrió un error');
      error.value = message;
      toast.error(message);
      return undefined;
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, run };
}
