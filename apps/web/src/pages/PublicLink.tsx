import { Clock, Download, FolderOpen, KeyRound, Lock, ShieldCheck, ShieldX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Logo } from '@/components/AppShell';
import DecryptedText from '@/components/reactbits/DecryptedText';
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
    <div className="flex min-h-svh flex-col items-center bg-[radial-gradient(50rem_24rem_at_50%_-8%,rgba(242,181,68,0.12),transparent)] px-4 py-10">
      <Logo />
      <div className="mt-10 w-full max-w-xl">
        {error && (
          <div className="rounded-3xl border border-line bg-surface p-8 text-center">
            <ShieldX className="mx-auto size-10 text-danger" />
            <h1 className="mt-4 font-display text-2xl font-bold">Lien indisponible</h1>
            <p className="mt-2 text-sm text-muted">{error}</p>
          </div>
        )}
        {!data && !error && <Spinner />}

        {data && data.state !== 'active' && (
          <div className="rounded-3xl border border-line bg-surface p-8 text-center">
            <Clock className="mx-auto size-10 text-warn" />
            <h1 className="mt-4 font-display text-2xl font-bold">{data.name}</h1>
            <p className="mt-2 text-sm text-muted">{data.message}</p>
            <p className="mt-4 text-xs text-faint">Demandez un nouveau lien à {data.sharedBy}.</p>
          </div>
        )}

        {data && data.state === 'active' && (
          <div className="overflow-hidden rounded-3xl border border-line bg-surface">
            <div className="border-b border-line p-6 sm:p-8">
              <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-gold uppercase">
                <ShieldCheck className="size-3.5" /> Partage sécurisé
              </p>
              <h1 className="mt-3 font-display text-2xl font-bold break-words sm:text-3xl">
                <DecryptedText text={data.name} animateOn="view" sequential speed={25} encryptedClassName="text-gold/60" />
              </h1>
              <p className="mt-2 text-sm text-muted">
                Partagé par <strong className="text-fg">{data.sharedBy}</strong>
                {data.label ? ` — ${data.label}` : ''}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" /> Expire {timeAgo(data.expiresAt)} ({formatDateTime(data.expiresAt)})
                </span>
                {data.remainingDownloads !== null && (
                  <span className="flex items-center gap-1.5">
                    <Download className="size-3.5" /> {data.remainingDownloads} téléchargement(s) restant(s)
                  </span>
                )}
                {data.protected && (
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="size-3.5" /> Protégé par mot de passe
                  </span>
                )}
              </div>
            </div>

            {!data.unlocked ? (
              <form onSubmit={unlock} className="flex flex-col gap-4 p-6 sm:p-8">
                <p className="flex items-center gap-2 text-sm">
                  <Lock className="size-4 text-gold" /> Saisissez le mot de passe communiqué par {data.sharedBy}.
                </p>
                {unlockError && <ErrorNote>{unlockError}</ErrorNote>}
                <Field label="Mot de passe" htmlFor="link-password">
                  <Input id="link-password" type="password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
                <Button type="submit" size="lg" loading={pending}>
                  Déverrouiller
                </Button>
              </form>
            ) : (
              <ul className="divide-y divide-line">
                {data.files?.length === 0 && (
                  <li className="flex items-center gap-2 p-6 text-sm text-muted">
                    <FolderOpen className="size-4" /> Ce dossier est vide.
                  </li>
                )}
                {data.files?.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-8">
                    <FileMark mime={f.mimeType} name={f.name} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.name}</p>
                      <p className="truncate text-xs text-muted">
                        <span className="font-mono">{formatBytes(f.size)}</span>
                        {data.kind === 'folder' && f.path ? ` · ${f.path}` : ''}
                      </p>
                    </div>
                    <a href={downloadUrl(f.id)} rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gold px-3 text-[13px] font-semibold text-ink hover:bg-gold-strong">
                      <Download className="size-4" /> <span className="hidden sm:inline">Télécharger</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <p className="mt-6 text-center text-xs text-faint">SafeShare — projet de démonstration. Les téléchargements sont enregistrés dans le journal du propriétaire.</p>
      </div>
    </div>
  );
}
