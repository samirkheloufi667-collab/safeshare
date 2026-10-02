import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useState } from 'react';

interface Toast {
  id: number;
  kind: 'success' | 'error';
  text: string;
}

const ToastContext = createContext<(kind: Toast['kind'], text: string) => void>(() => undefined);

/** Notifications éphémères, comme une ligne de journal qui s'imprime en bas d'écran. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, kind, text }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-4 z-[2000] flex flex-col gap-2 pr-4" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ clipPath: 'inset(0 100% 0 0)' }}
              animate={{ clipPath: 'inset(0 0% 0 0)' }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto flex max-w-md items-baseline gap-3 border border-line-strong bg-surface-2 px-4 py-2.5 font-mono text-[13px]"
            >
              <span className={t.kind === 'success' ? 'text-fg' : 'text-seal'}>{t.kind === 'success' ? 'OK' : 'ERR'}</span>
              <span className="text-muted">{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
