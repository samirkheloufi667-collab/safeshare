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
      className={`sheet z-[3000] m-auto w-[calc(100%-2rem)] border border-line-strong bg-surface p-0 text-fg ${wide ? 'max-w-2xl' : 'max-w-lg'}`}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line-strong px-5 py-3.5">
            <h2 className="display truncate text-[17px]">{title}</h2>
            <button type="button" onClick={onClose} className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase hover:text-fg" aria-label="Fermer">
              Échap ✕
            </button>
          </div>
          <div className="overflow-y-auto p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
