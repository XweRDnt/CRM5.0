import { toast as sonnerToast } from "sonner";

export interface ToastOptions {
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastPromiseOptions<T> {
  loading: string;
  success: string | ((data: T) => string);
  error: string | ((error: unknown) => string);
}

export const toast = {
  success: (message: string, options?: ToastOptions): void => {
    sonnerToast.success(message, options);
  },
  error: (message: string, options?: ToastOptions): void => {
    sonnerToast.error(message, options);
  },
  info: (message: string, options?: ToastOptions): void => {
    sonnerToast.info(message, options);
  },
  promise: <T>(promise: Promise<T>, options: ToastPromiseOptions<T>): void => {
    sonnerToast.promise(promise, options);
  },
};
