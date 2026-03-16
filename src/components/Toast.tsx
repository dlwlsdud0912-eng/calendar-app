'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

type ToastType = 'success' | 'error' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_COLORS: Record<ToastType, string> = {
  success: '#0f7b6c',
  error: '#e03e3e',
  warning: '#c07b2a',
};

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '!',
};

function ToastItemComponent({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Trigger slide-up animation on mount
    const enterTimer = setTimeout(() => setVisible(true), 10);

    // Auto-dismiss after 3 seconds
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(item.id), 300);
    }, 3000);

    return () => {
      clearTimeout(enterTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [item.id, onRemove]);

  const handleClose = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
    setTimeout(() => onRemove(item.id), 300);
  }, [item.id, onRemove]);

  const color = TOAST_COLORS[item.type];
  const icon = TOAST_ICONS[item.type];

  return (
    <div
      style={{
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
      }}
      className="flex items-center gap-3 bg-white rounded-xl shadow-lg border border-[#e3e2e0] px-4 py-3 min-w-[260px] max-w-[360px] w-full"
    >
      {/* Type indicator */}
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>

      {/* Message */}
      <p className="flex-1 text-sm text-[#37352f] leading-snug">{item.message}</p>

      {/* Close button */}
      <button
        onClick={handleClose}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-[#9b9a97] hover:text-[#37352f] hover:bg-[#f7f7f5] transition-colors text-xs"
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: (message) => addToast('success', message),
    error: (message) => addToast('error', message),
    warning: (message) => addToast('warning', message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container: bottom center, above everything */}
      <div
        className="fixed left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
        style={{ zIndex: 9999, bottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {toasts.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <ToastItemComponent item={item} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
