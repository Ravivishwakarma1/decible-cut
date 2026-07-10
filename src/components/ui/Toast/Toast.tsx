import React from 'react';
import styles from './Toast.module.css';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useUIStore } from '../../../store/uiStore';
import type { ToastMessage } from '../../../types/ui.types';

const ICONS = {
  success: <CheckCircle size={16} />,
  error: <AlertCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
};

const ToastItem: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const removeToast = useUIStore((s) => s.removeToast);
  return (
    <div className={`${styles.toast} ${styles[toast.type]} animate-slideInRight`}>
      <span className={styles.icon}>{ICONS[toast.type]}</span>
      <div className={styles.content}>
        <p className={styles.title}>{toast.title}</p>
        {toast.message && <p className={styles.message}>{toast.message}</p>}
      </div>
      <button
        className={styles.close}
        onClick={() => removeToast(toast.id)}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const toasts = useUIStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className={styles.container} aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
};
