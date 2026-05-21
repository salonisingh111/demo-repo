'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
import { CheckCircle, XCircle, Zap, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, title: string, message?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const contextValue = useMemo(() => ({
    toasts,
    addToast,
    removeToast,
  }), [toasts, addToast, removeToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none">
        {toasts.map((toast) => {
          let borderColor = 'border-white/10';
          let accentBarBg = 'bg-white/10';
          let Icon = Zap;
          let iconColor = 'text-white';

          if (toast.type === 'success') {
            borderColor = 'border-[#10b981]/30';
            accentBarBg = 'bg-[#10b981]';
            Icon = CheckCircle;
            iconColor = 'text-[#10b981]';
          } else if (toast.type === 'error') {
            borderColor = 'border-rose-500/30';
            accentBarBg = 'bg-rose-500';
            Icon = XCircle;
            iconColor = 'text-rose-400';
          } else if (toast.type === 'info') {
            borderColor = 'border-[#7c3aed]/30';
            accentBarBg = 'bg-[#7c3aed]';
            Icon = Zap;
            iconColor = 'text-[#7c3aed]';
          }

          return (
            <div
              key={toast.id}
              className={`min-w-[280px] max-w-sm bg-[#0c0c10] border ${borderColor} rounded-xl px-4 py-3 flex items-start gap-3 shadow-2xl shadow-black/60 pointer-events-auto relative overflow-hidden transition-all duration-300 animate-in slide-in-from-right`}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentBarBg}`} />

              <Icon className={`h-5 w-5 ${iconColor} mt-0.5 shrink-0`} />

              <div className="flex-1 pr-4">
                <h4 className="text-sm font-semibold text-white">{toast.title}</h4>
                {toast.message && <p className="text-xs text-[#6b7280] mt-0.5 leading-relaxed">{toast.message}</p>}
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="text-[#6b7280] hover:text-white transition-colors p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  const toast = {
    success: (title: string, message?: string) => context.addToast('success', title, message),
    error: (title: string, message?: string) => context.addToast('error', title, message),
    info: (title: string, message?: string) => context.addToast('info', title, message),
  };

  return toast;
}
