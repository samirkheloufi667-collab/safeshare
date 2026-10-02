import { Link } from 'react-router';
import { Stagger } from '@/components/motion/Stagger';
import { Badge, Button, EmptyState, ErrorNote, PageHeader, Spinner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { cx, formatDateTime, LINK_STATE_COLOR, LINK_STATE_LABEL, timeAgo } from '@/lib/format';
import type { Link as ShareLink } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/** Durée de vie restante d'un lien, en caractères : il se vide à mesure qu'il approche de l'expiration. */
function Life({ link }: { link: ShareLink }) {
  const cells = 16;
  const start = new Date(link.createdAt).getTime();
  const end = new Date(link.expiresAt).getTime();
  const left = link.state === 'active' ? Math.max(0, Math.min(1, (end - Date.now()) / (end - start))) : 0;
  const full = Math.round(left * cells);
  return (
    <span className="font-mono text-[11px] tracking-[-0.05em]" title={`${Math.round(left * 100)} % de durée restante`} aria-hidden>
      <span className={left < 0.15 ? 'text-seal' : 'text-fg'}>{'█'.repeat(full)}</span>
      <span className="text-line-strong">{'░'.repeat(cells - full)}</span>
    </span>
  );
}

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
    <div className="flex flex-col gap-8">
      <PageHeader
        path="~/liens"
        title="Liens publics"
        subtitle={links.data ? `${active} lien${active > 1 ? 's' : ''} encore ouvert${active > 1 ? 's' : ''}. Un lien se crée depuis « Partager » sur un fichier ou un dossier.` : undefined}
      />
      {links.error && <ErrorNote>{links.error}</ErrorNote>}
      {links.loading && !links.data && <Spinner />}
      {links.data?.length === 0 && <EmptyState title="Aucun lien." text="Créez un lien temporaire pour envoyer un fichier à quelqu’un qui n’a pas de compte." />}
      {links.data && links.data.length > 0 && (
        <Stagger as="ul" watch={links.data.length} className="border-t border-line-strong">
          {links.data.map((l) => {
            const target = l.folder ?? l.file;
            return (
              <li key={l.id} data-reveal className={cx('grid gap-x-6 gap-y-2 border-b border-line px-2 py-4 md:grid-cols-[1fr_auto_auto] md:items-center', l.state !== 'active' && 'opacity-55')}>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[14px]">
                    <span className={cx('truncate', l.state === 'revoked' && 'line-through decoration-seal')}>{l.label ?? 'Lien sans libellé'}</span>
                    {l.protected && <span className="font-mono text-[10px] text-seal">● MDP</span>}
                  </p>
                  <p className="mt-1 truncate font-mono text-[11px] text-muted">
                    …{l.tokenHint} → {l.folder ? 'dossier ' : 'fichier '}
                    {l.folder ? (
                      <Link to={`/drive/${l.folder.id}`} className="u-link text-fg">
                        {target?.name}/
                      </Link>
                    ) : (
                      <span className="text-fg">{target?.name}</span>
                    )}{' '}
                    · créé {timeAgo(l.createdAt)}
                  </p>
                </div>
                <div className="font-mono text-[11px] text-muted md:text-right">
                  <Life link={l} />
                  <p className="mt-0.5">
                    {l.state === 'active' ? `expire ${timeAgo(l.expiresAt)}` : `fin ${formatDateTime(l.revokedAt ?? l.expiresAt)}`} · {l.downloadCount}
                    {l.maxDownloads ? `/${l.maxDownloads}` : ''} tél.
                  </p>
                </div>
                <div className="flex items-center gap-3 md:w-48 md:justify-end">
                  <Badge color={LINK_STATE_COLOR[l.state]}>{LINK_STATE_LABEL[l.state]}</Badge>
                  {l.state === 'active' && (
                    <Button variant="danger" size="sm" onClick={() => revoke(l)}>
                      Désactiver
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
