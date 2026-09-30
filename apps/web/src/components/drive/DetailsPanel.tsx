import { Download, Fingerprint, Share2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import DecryptedText from '@/components/reactbits/DecryptedText';
import { Badge, Button, FileMark, Spinner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { downloadFile, errorMessage, previewUrl } from '@/lib/api';
import { formatBytes, formatDateTime, ROLE_LABEL } from '@/lib/format';
import type { FileDetail } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/** Panneau latéral d'un fichier : aperçu (images), informations et empreinte d'intégrité. */
export function DetailsPanel({ fileId, onClose, onShare }: { fileId: string; onClose: () => void; onShare: (file: FileDetail) => void }) {
  const toast = useToast();
  const detail = useApi<FileDetail>(`/files/${fileId}`);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    setPreview(null);
    if (detail.data?.previewable) {
      previewUrl(fileId)
        .then(setPreview)
        .catch(() => setPreview(null));
    }
  }, [detail.data, fileId]);

  // Échap ferme le panneau, comme une fenêtre modale.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const f = detail.data;
  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-line bg-surface shadow-2xl shadow-black/60" aria-label="Détails du fichier">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-display text-lg font-semibold">Détails</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Fermer les détails">
          <X className="size-4" />
        </button>
      </div>
      {!f ? (
        <Spinner />
      ) : (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-line bg-ink">
            {preview ? <img src={preview} alt={`Aperçu de ${f.name}`} className="size-full object-contain" /> : <FileMark mime={f.mimeType} name={f.name} size={72} />}
          </div>
          <h3 className="mt-5 font-display text-xl font-semibold break-words">{f.name}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge color="var(--color-gold)">{ROLE_LABEL[f.role]}</Badge>
            <Badge color="var(--color-muted)">{f.mimeType}</Badge>
          </div>

          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted">Taille</dt>
            <dd className="font-mono">{formatBytes(f.size)}</dd>
            <dt className="text-muted">Propriétaire</dt>
            <dd>{f.ownerName}</dd>
            <dt className="text-muted">Importé par</dt>
            <dd>{f.uploaderName}</dd>
            <dt className="text-muted">Ajouté le</dt>
            <dd>{formatDateTime(f.createdAt)}</dd>
            {f.breadcrumbs.length > 0 && (
              <>
                <dt className="text-muted">Emplacement</dt>
                <dd className="truncate">{f.breadcrumbs.map((c) => c.name).join(' / ')}</dd>
              </>
            )}
          </dl>

          <div className="mt-6 rounded-2xl border border-line bg-ink/60 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-muted uppercase">
              <Fingerprint className="size-3.5 text-gold" /> Empreinte SHA-256
            </p>
            <p className="mt-2 font-mono text-[11px] leading-relaxed break-all text-fg">
              <DecryptedText text={f.sha256} animateOn="view" sequential revealDirection="start" speed={12} characters="0123456789abcdef" encryptedClassName="text-gold/70" />
            </p>
            <p className="mt-2 text-[12px] text-muted">Recalculée à chaque import : comparez-la après téléchargement pour vérifier que le fichier n’a pas été altéré.</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => downloadFile(f.id).catch((e) => toast('error', errorMessage(e)))}>
              <Download className="size-4" /> Télécharger
            </Button>
            {f.role === 'OWNER' && (
              <Button variant="secondary" onClick={() => onShare(f)}>
                <Share2 className="size-4" /> Partager
              </Button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
