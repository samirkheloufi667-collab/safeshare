import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { cx } from '@/lib/format';

export interface MenuAction {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  hint?: string;
}

/** Menu « ⋯ » d'un élément : se ferme au clic extérieur et à la touche Échap. */
export function ItemMenu({ actions, label, inverted }: { actions: MenuAction[]; label: string; inverted?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  if (actions.length === 0) return null;
  return (
    <div ref={ref} className="relative justify-self-end">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cx('flex size-8 items-center justify-center font-mono text-[15px] transition-colors', inverted ? 'text-ink hover:bg-ink/10' : 'text-muted hover:text-fg')}
        aria-label={`Actions pour ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ⋯
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, clipPath: 'inset(0 0 100% 0)' }}
            animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full right-0 z-20 mt-1 w-52 border border-line-strong bg-surface-2 py-1 text-fg"
          >
            {actions.map(({ label: text, onSelect, danger, hint }) => (
              <button
                key={text}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onSelect();
                }}
                className={cx('flex w-full items-center justify-between px-3.5 py-2 text-left font-mono text-[12px] transition-colors hover:bg-fg hover:text-ink', danger ? 'text-seal' : 'text-fg')}
              >
                {text}
                {hint && <span className="opacity-50">{hint}</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
