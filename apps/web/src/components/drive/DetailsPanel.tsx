import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Scramble } from '@/components/motion/Scramble';
import { Badge, Button, FileMark, Spinner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { downloadFile, errorMessage, previewUrl } from '@/lib/api';
import { formatBytes, formatDateTime, ROLE_LABEL } from '@/lib/format';
import type { FileDetail } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/**
 * Fiche d'un fichier, comme une fiche d'inventaire : aperçu (images),
 * informations, puis l'empreinte SHA-256 qui se déchiffre caractère par caractère.
 */
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
  const rows: [string, React.ReactNode][] = f
    ? [
        ['Taille', <span className="font-mono">{formatBytes(f.size)}</span>],
        ['Type', <span className="font-mono text-[12px]">{f.mimeType}</span>],
        ['Propriétaire', f.ownerName],
        ['Importé par', f.uploaderName],
        ['Ajouté le', formatDateTime(f.createdAt)],
        ...(f.breadcrumbs.length > 0 ? ([['Emplacement', <span className="font-mono text-[12px]">~/{f.breadcrumbs.map((c) => c.name).join('/')}</span>]] as [string, React.ReactNode][]) : []),
      ]
    : [];

  return (
    <motion.aside
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-line-strong bg-surface"
      aria-label="Détails du fichier"
    >
      <div className="flex h-14 items-center justify-between border-b border-line-strong px-5">
        <p className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">Fiche</p>
        <button type="button" onClick={onClose} className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase hover:text-fg" aria-label="Fermer les détails">
          Échap ✕
        </button>
      </div>
      {!f ? (
        <Spinner />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-line bg-ink">
            {preview ? <img src={preview} alt={`Aperçu de ${f.name}`} className="size-full object-contain" /> : <FileMark mime={f.mimeType} name={f.name} size={88} />}
          </div>
          <div className="p-5">
            <h3 className="display text-xl leading-tight break-words">{f.name}</h3>
            <div className="mt-3">
              <Badge color="var(--color-muted)">{ROLE_LABEL[f.role]}</Badge>
            </div>

            <dl className="mt-6 border-t border-line">
              {rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[8rem_1fr] gap-4 border-b border-line py-2.5 text-sm">
                  <dt className="font-mono text-[11px] tracking-[0.08em] text-faint uppercase">{k}</dt>
                  <dd className="min-w-0 truncate">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 border border-line-strong p-4">
              <p className="flex items-center justify-between font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
                Empreinte SHA-256 <span className="text-seal">● scellé</span>
              </p>
              <p className="mt-3 font-mono text-[12px] leading-relaxed break-all text-fg">
                <Scramble text={f.sha256} duration={1.8} />
              </p>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">Calculée à l’import. Comparez-la après téléchargement : un seul octet modifié et elle n’a plus rien à voir.</p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => downloadFile(f.id).catch((e) => toast('error', errorMessage(e)))}>Télécharger</Button>
              {f.role === 'OWNER' && (
                <Button variant="secondary" onClick={() => onShare(f)}>
                  Partager
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.aside>
  );
}
