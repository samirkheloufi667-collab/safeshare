import { MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cx } from '@/lib/format';

export interface MenuAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  danger?: boolean;
}

/** Menu « … » d'un élément : se ferme au clic extérieur et à la touche Échap. */
export function ItemMenu({ actions, label }: { actions: MenuAction[]; label: string }) {
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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-3 hover:text-fg"
        aria-label={`Actions pour ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-line-strong bg-surface-2 py-1 shadow-2xl shadow-black/60">
          {actions.map(({ label: text, icon: Icon, onSelect, danger }) => (
            <button
              key={text}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onSelect();
              }}
              className={cx('flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-surface-3', danger ? 'text-danger' : 'text-fg')}
            >
              <Icon className="size-4 opacity-80" /> {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
