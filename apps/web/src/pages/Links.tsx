import { KeyRound, Link2 } from 'lucide-react';
import { Link } from 'react-router';
import { Badge, Button, EmptyState, ErrorNote, PageHeader, Spinner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { cx, formatDateTime, LINK_STATE_COLOR, LINK_STATE_LABEL, timeAgo } from '@/lib/format';
import type { Link as ShareLink } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/** Tous mes liens publics, actifs ou non : on voit d'un coup d'œil ce qui est encore ouvert. */
export default function Links() {
  const toast = useToast();
  const links = useApi<ShareLink[]>('/links');

  async function revoke(link: ShareLink) {
    try {
      await api(`/links/${link.id}`, { method: 'DELETE' });
      toast('success', 'Lien désactivé');
      void links.reload();
    } catch (e) {
      toast('error', errorMessage(e));
    }
  }

  const active = links.data?.filter((l) => l.state === 'active').length ?? 0;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Liens de partage"
        subtitle={links.data ? `${active} lien(s) actif(s). Un lien se crée depuis le menu « Partager » d’un fichier ou d’un dossier.` : undefined}
      />
      {links.error && <ErrorNote>{links.error}</ErrorNote>}
      {links.loading && !links.data && <Spinner />}
      {links.data?.length === 0 && <EmptyState icon={<Link2 className="size-5" />} title="Aucun lien" text="Créez un lien temporaire pour envoyer un fichier à quelqu’un qui n’a pas de compte." />}
      {links.data && links.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {links.data.map((l) => {
            const target = l.folder ?? l.file;
            return (
              <li key={l.id} className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface px-4 py-3.5', l.state !== 'active' && 'opacity-70')}>
                <div className="min-w-0 flex-1 basis-60">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{l.label ?? 'Lien sans libellé'}</span>
                    {l.protected && <KeyRound className="size-3.5 shrink-0 text-gold" aria-label="Protégé par mot de passe" />}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {l.folder ? 'Dossier' : 'Fichier'}{' '}
                    {l.folder ? (
                      <Link to={`/drive/${l.folder.id}`} className="text-fg hover:text-gold">
                        {target?.name}
                      </Link>
                    ) : (
                      <span className="text-fg">{target?.name}</span>
                    )}{' '}
                    · créé {timeAgo(l.createdAt)}
                  </p>
                </div>
                <span className="font-mono text-xs text-muted">…{l.tokenHint}</span>
                <span className="w-44 text-xs text-muted">{l.state === 'active' ? `Expire ${timeAgo(l.expiresAt)}` : `Fin : ${formatDateTime(l.revokedAt ?? l.expiresAt)}`}</span>
                <span className="w-24 font-mono text-xs text-muted">
                  {l.downloadCount}
                  {l.maxDownloads ? ` / ${l.maxDownloads}` : ''} tél.
                </span>
                <Badge color={LINK_STATE_COLOR[l.state]}>{LINK_STATE_LABEL[l.state]}</Badge>
                {l.state === 'active' ? (
                  <Button variant="danger" size="sm" onClick={() => revoke(l)}>
                    Désactiver
                  </Button>
                ) : (
                  <span className="w-[86px]" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
