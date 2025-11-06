import { v4 as uuidv4 } from 'uuid';
type Toast = {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
};
const createSharedToastQueue = () => {
  let toastQueue = $state<Toast[]>([]);
  return {
    addToast: (toast: Omit<Toast, 'id'>) => {
      const id = uuidv4();
      toastQueue.push({ ...toast, id });
      window.setTimeout(() => {
        toastQueue = toastQueue.filter((t) => t.id !== id);
      }, 3000);
    },
    getToastQueue: () => toastQueue,
  };
};
export const sharedToastQueue = createSharedToastQueue();
