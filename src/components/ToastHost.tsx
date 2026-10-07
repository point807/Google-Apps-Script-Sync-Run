/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect } from 'react';
import { X, AlertTriangle, CheckCircle2, Info, AlertOctagon } from 'lucide-react';
import { useAppStore, Toast } from '../store/appStore';

const TOAST_STYLE: Record<Toast['type'], { box: string; icon: React.ReactNode }> = {
  error: {
    box: 'border-rose-500/40 bg-rose-950/90 text-rose-200',
    icon: <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
  },
  success: {
    box: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
  },
  warning: {
    box: 'border-amber-500/40 bg-amber-950/90 text-amber-200',
    icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
  },
  info: {
    box: 'border-indigo-500/40 bg-indigo-950/90 text-indigo-200',
    icon: <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
  }
};

const AUTO_DISMISS_MS = 6000;

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: number) => void }> = ({
  toast,
  onDismiss
}) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const style = TOAST_STYLE[toast.type];
  return (
    <div
      className={`flex items-start gap-2.5 p-3 rounded-xl border shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-right ${style.box}`}
    >
      {style.icon}
      <span className="text-xs leading-relaxed flex-1 break-words">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="p-0.5 rounded hover:bg-white/10 transition cursor-pointer shrink-0"
        title="Закрыть"
      >
        <X className="w-3.5 h-3.5 opacity-70" />
      </button>
    </div>
  );
};

/** Stack of transient notifications (errors and importants events). */
export const ToastHost: React.FC = () => {
  const toasts = useAppStore((s) => s.toasts);
  const dismissToast = useAppStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[70] w-80 max-w-[calc(100vw-2rem)] space-y-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
};
