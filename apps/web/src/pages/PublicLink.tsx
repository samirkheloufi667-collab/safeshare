import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Copyright, Logo } from '@/components/AppShell';
import { Scramble } from '@/components/motion/Scramble';
import { Seal } from '@/components/motion/Seal';
import { Button, ErrorNote, Field, FileMark, Input, Spinner } from '@/components/ui/primitives';
import { API_URL, ApiError, errorMessage } from '@/lib/api';
import { formatBytes, formatDateTime, timeAgo } from '@/lib/format';
import type { PublicLink as PublicLinkData } from '@/lib/types';

/**
 * Page ouverte par un destinataire sans compte. Le jeton du lien est dans
 * l'adresse ; la balise « referrer » de index.html empêche qu'il fuite vers
 * un autre site. Un lien protégé ne montre rien de son contenu avant le mot de passe.
 */
export default function PublicLink() {
  const { token = '' } = useParams();
  const [data, setData] = useState<PublicLinkData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [access, setAccess] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(
    async (accessToken: string | null) => {
      try {
        const res = await fetch(`${API_URL}/public/links/${encodeURIComponent(token)}`, {
          headers: accessToken ? { 'X-Link-Access': accessToken } : {},
        });
        const body = await res.json();
        if (!res.ok) throw new ApiError(res.status, body.message ?? 'Lien invalide');
        setData(body);
        setError(null);
      } catch (e) {
        setError(errorMessage(e));
      }
    },
    [token],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setUnlockError(null);
    try {
      const res = await fetch(`${API_URL}/public/links/${encodeURIComponent(token)}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const body = await res.json();
      if (!res.ok) throw new ApiError(res.status, body.message);
      setAccess(body.access);
      setPassword('');
      await load(body.access);
    } catch (err) {
      setUnlockError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  function downloadUrl(fileId: string) {
    const params = new URLSearchParams();
    if (data?.kind === 'folder') params.set('fileId', fileId);
    if (access) params.set('access', access);
    return `${API_URL}/public/links/${encodeURIComponent(token)}/download?${params}`;
  }

  return (
    <div className="flex min-h-svh flex-col px-4 py-6 sm:px-8">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
        <Logo />
        <span className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">Lien de partage</span>
      </div>

      <div className="mx-auto mt-14 w-full max-w-3xl flex-1">
        {error && (
          <div className="border border-line-strong p-8">
            <p className="font-mono text-[11px] tracking-[0.12em] text-seal uppercase">Accès refusé</p>
            <h1 className="display mt-3 text-3xl">Lien indisponible.</h1>
            <p className="mt-3 text-sm text-muted">{error}</p>
          </div>
        )}
        {!data && !error && <Spinner />}

        {data && data.state !== 'active' && (
          <div className="border border-line-strong p-8">
            <p className="font-mono text-[11px] tracking-[0.12em] text-seal uppercase">Sceau rompu</p>
            <h1 className="display mt-3 text-3xl break-words line-through decoration-seal">{data.name}</h1>
            <p className="mt-3 text-sm text-muted">{data.message}</p>
            <p className="mt-6 font-mono text-[12px] text-faint">→ demandez un nouveau lien à {data.sharedBy}.</p>
          </div>
        )}

        {data && data.state === 'active' && (
          <div className="border border-line-strong">
            <div className="flex flex-col gap-6 border-b border-line-strong p-6 sm:flex-row sm:items-start sm:p-8">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">
                  {data.kind === 'folder' ? 'Dossier' : 'Fichier'} partagé par <span className="text-fg">{data.sharedBy}</span>
                </p>
                <Scramble as="h1" text={data.name} duration={1} chars="abcdefghijklmnopqrstuvwxyz0123456789" className="display mt-3 block text-3xl leading-tight break-words sm:text-4xl" />
                {data.label && <p className="mt-2 text-muted">{data.label}</p>}
                <dl className="mt-6 grid gap-x-6 gap-y-1 font-mono text-[12px] sm:grid-cols-[auto_1fr]">
                  <dt className="text-faint">expire</dt>
                  <dd>
                    {timeAgo(data.expiresAt)} <span className="text-faint">({formatDateTime(data.expiresAt)})</span>
                  </dd>
                  {data.remainingDownloads !== null && (
                    <>
                      <dt className="text-faint">restant</dt>
                      <dd>{data.remainingDownloads} téléchargement(s)</dd>
                    </>
                  )}
                  <dt className="text-faint">protection</dt>
                  <dd>{data.protected ? (data.unlocked ? 'mot de passe — déverrouillé' : 'mot de passe') : 'aucune'}</dd>
                </dl>
              </div>
              {/* Le sceau tombe quand le contenu devient accessible. */}
              <Seal key={String(data.unlocked)} size={110} stamp={data.unlocked} label="SAFESHARE · LIEN SCELLÉ · " />
            </div>

            {!data.unlocked ? (
              <form onSubmit={unlock} className="flex flex-col gap-5 p-6 sm:p-8">
                <p className="text-sm text-muted">Saisissez le mot de passe communiqué par {data.sharedBy}. Chaque tentative est inscrite dans son journal.</p>
                {unlockError && <ErrorNote>{unlockError}</ErrorNote>}
                <Field label="Mot de passe" htmlFor="link-password">
                  <Input id="link-password" type="password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
                <Button type="submit" size="lg" loading={pending} className="self-start">
                  Rompre le sceau
                </Button>
              </form>
            ) : (
              <ul>
                {data.files?.length === 0 && <li className="p-6 font-mono text-[12px] text-faint">— ce dossier est vide.</li>}
                {data.files?.map((f) => (
                  <li key={f.id} className="flex items-center gap-4 border-b border-line px-6 py-3.5 last:border-b-0 sm:px-8">
                    <FileMark mime={f.mimeType} name={f.name} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px]">{f.name}</p>
                      <p className="truncate font-mono text-[11px] text-muted">
                        {formatBytes(f.size)}
                        {data.kind === 'folder' && f.path ? ` · ${f.path}` : ''}
                        {f.sha256 ? ` · sha256 ${f.sha256.slice(0, 12)}…` : ''}
                      </p>
                    </div>
                    <a href={downloadUrl(f.id)} rel="noopener noreferrer" className="inline-flex h-9 items-center bg-fg px-3 font-mono text-[11px] font-semibold tracking-[0.08em] text-ink uppercase transition-colors hover:bg-seal-strong">
                      Télécharger
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <p className="mt-6 font-mono text-[11px] text-faint">Les téléchargements sont enregistrés dans le journal du propriétaire.</p>
      </div>
      <Copyright className="mx-auto mt-12 w-full max-w-3xl" />
    </div>
  );
}
