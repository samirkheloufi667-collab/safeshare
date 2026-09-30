import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

/**
 * Fenêtre modale fondée sur <dialog> : le navigateur gère le piège du focus,
 * la touche Échap et l'accessibilité. Le composant se contente de l'ouvrir
 * et de la fermer selon `open`.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Un clic sur le fond (hors du contenu) ferme la fenêtre.
        if (e.target === ref.current) onClose();
      }}
      className={`m-auto z-[3000] w-[calc(100%-2rem)] rounded-3xl border border-line bg-surface p-0 text-fg shadow-2xl shadow-black/60 backdrop:bg-black/70 backdrop:backdrop-blur-sm ${wide ? 'max-w-2xl' : 'max-w-lg'}`}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-display text-lg font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
              aria-label="Fermer"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="overflow-y-auto p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
