import { Check, Copy, KeyRound, Link2, ShieldAlert, Trash2, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Badge, Button, ErrorNote, Field, Input, Select } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { cx, DURATIONS, formatDateTime, LINK_STATE_COLOR, LINK_STATE_LABEL, timeAgo } from '@/lib/format';
import type { Link, Share, ShareRole } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export interface ShareTarget {
  kind: 'folder' | 'file';
  id: string;
  name: string;
}

/** Partage d'un élément : accès nominatifs d'un côté, liens publics temporaires de l'autre. */
export function ShareDialog({ target, onClose, onChanged }: { target: ShareTarget | null; onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<'people' | 'links'>('people');
  return (
    <Modal open={target !== null} onClose={onClose} title={target ? `Partager « ${target.name} »` : ''} wide>
      {target && (
        <>
          <div className="mb-5 inline-flex rounded-xl bg-surface-2 p-1" role="tablist">
            {[
              { id: 'people' as const, label: 'Personnes', icon: Users },
              { id: 'links' as const, label: 'Lien public', icon: Link2 },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cx('flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors', tab === id ? 'bg-surface-3 text-fg' : 'text-muted hover:text-fg')}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
          {tab === 'people' ? <PeopleTab target={target} onChanged={onChanged} /> : <LinksTab target={target} onChanged={onChanged} />}
        </>
      )}
    </Modal>
  );
}

const query = (t: ShareTarget) => `${t.kind === 'folder' ? 'folderId' : 'fileId'}=${t.id}`;

function PeopleTab({ target, onChanged }: { target: ShareTarget; onChanged: () => void }) {
  const toast = useToast();
  const shares = useApi<Share[]>(`/shares?${query(target)}`);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ShareRole>('VIEWER');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const body = target.kind === 'folder' ? { folderId: target.id } : { fileId: target.id };

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api('/shares', { method: 'POST', json: { ...body, email, role } });
      toast('success', `Accès accordé à ${email}`);
      setEmail('');
      void shares.reload();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function update(share: Share, next: ShareRole) {
    try {
      await api(`/shares/${share.id}`, { method: 'PATCH', json: { role: next } });
      void shares.reload();
    } catch (err) {
      toast('error', errorMessage(err));
    }
  }

  async function remove(share: Share) {
    try {
      await api(`/shares/${share.id}`, { method: 'DELETE' });
      toast('success', `${share.user.name} n’a plus accès`);
      void shares.reload();
      onChanged();
    } catch (err) {
      toast('error', errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Inviter par e-mail" htmlFor="share-email">
            <Input id="share-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="collegue@exemple.fr" />
          </Field>
        </div>
        <Select value={role} onChange={(e) => setRole(e.target.value as ShareRole)} className="sm:w-44" aria-label="Droits">
          <option value="VIEWER">Lecture seule</option>
          <option value="EDITOR">Peut modifier</option>
        </Select>
        <Button type="submit" loading={pending}>
          <UserPlus className="size-4" /> Inviter
        </Button>
      </form>
      {error && <ErrorNote>{error}</ErrorNote>}
      {target.kind === 'folder' && (
        <p className="text-[13px] text-muted">L’accès vaut pour tout le contenu du dossier, sous-dossiers compris. La personne ne voit pas les dossiers situés au-dessus.</p>
      )}

      <ul className="divide-y divide-line rounded-2xl border border-line">
        {shares.data?.length === 0 && <li className="px-4 py-5 text-center text-sm text-muted">Personne d’autre n’a accès pour l’instant.</li>}
        {shares.data?.map((s) => (
          <li key={s.id} className={cx('flex flex-wrap items-center gap-3 px-4 py-3', s.inheritedFrom && 'bg-surface-2/40')}>
            <span className="flex size-8 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-gold">
              {s.user.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{s.user.name}</p>
              <p className="truncate text-xs text-muted">{s.user.email}</p>
            </div>
            {s.inheritedFrom ? (
              <p className="text-right text-xs text-muted">
                <Badge color="var(--color-muted)">{s.role === 'EDITOR' ? 'Peut modifier' : 'Lecture seule'}</Badge>
                <span className="mt-1 block">hérité de « {s.inheritedFrom.name} »</span>
              </p>
            ) : (
              <>
            <Select value={s.role} onChange={(e) => update(s, e.target.value as ShareRole)} className="h-9 w-40 text-sm" aria-label={`Droits de ${s.user.name}`}>
              <option value="VIEWER">Lecture seule</option>
              <option value="EDITOR">Peut modifier</option>
            </Select>
            <button type="button" onClick={() => remove(s)} className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Retirer l’accès de ${s.user.name}`}>
              <Trash2 className="size-4" />
            </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinksTab({ target, onChanged }: { target: ShareTarget; onChanged: () => void }) {
  const toast = useToast();
  const links = useApi<Link[]>(`/links?${query(target)}`);
  const [form, setForm] = useState({ duration: '24h', password: '', maxDownloads: '', label: '' });
  const [created, setCreated] = useState<Link | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const link = await api<Link>('/links', {
        method: 'POST',
        json: {
          ...(target.kind === 'folder' ? { folderId: target.id } : { fileId: target.id }),
          duration: form.duration,
          password: form.password || undefined,
          maxDownloads: form.maxDownloads ? Number(form.maxDownloads) : undefined,
          label: form.label || undefined,
        },
      });
      setCreated(link);
      setCopied(false);
      setForm({ duration: '24h', password: '', maxDownloads: '', label: '' });
      void links.reload();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      toast('error', 'Copie impossible : sélectionnez le lien à la main.');
    }
  }

  async function revoke(link: Link) {
    try {
      await api(`/links/${link.id}`, { method: 'DELETE' });
      toast('success', 'Lien désactivé : il ne fonctionne plus, pour personne.');
      void links.reload();
      onChanged();
    } catch (err) {
      toast('error', errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {created?.url && (
        <div className="rounded-2xl border border-gold/40 bg-gold-soft p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-gold">
            <ShieldAlert className="size-4" /> Copiez ce lien maintenant
          </p>
          <p className="mt-1 text-[13px] text-muted">
            Pour votre sécurité, SafeShare n’en garde qu’une empreinte : il ne pourra plus être affiché. En cas de perte, créez-en un nouveau.
          </p>
          <div className="mt-3 flex gap-2">
            <input readOnly value={created.url} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-xl border border-line-strong bg-ink px-3 font-mono text-xs text-fg" aria-label="Lien de partage" />
            <Button onClick={() => copy(created.url!)} variant={copied ? 'secondary' : 'primary'}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? 'Copié' : 'Copier'}
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
        <Field label="Durée de validité" htmlFor="l-duration">
          <Select id="l-duration" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Téléchargements maximum" htmlFor="l-max">
          <Input id="l-max" type="number" min={1} max={1000} placeholder="Illimité" value={form.maxDownloads} onChange={(e) => setForm({ ...form, maxDownloads: e.target.value })} />
        </Field>
        <Field label="Mot de passe (facultatif)" htmlFor="l-password" hint="À transmettre par un autre canal que le lien.">
          <Input id="l-password" type="password" autoComplete="new-password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Libellé (facultatif)" htmlFor="l-label" hint="Pour vous y retrouver : « Pour le comptable »…">
          <Input id="l-label" maxLength={80} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" loading={pending} className="mt-1 w-full sm:w-auto">
            <Link2 className="size-4" /> Créer le lien
          </Button>
        </div>
      </form>

      <div>
        <p className="mb-2 text-sm font-medium">Liens de cet élément</p>
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {links.data?.length === 0 && <li className="px-4 py-5 text-center text-sm text-muted">Aucun lien pour l’instant.</li>}
          {links.data?.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{l.label ?? 'Lien sans libellé'}</span>
                  {l.protected && <KeyRound className="size-3.5 text-gold" aria-label="Protégé par mot de passe" />}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-muted">
                  …{l.tokenHint} · {l.state === 'active' ? `expire ${timeAgo(l.expiresAt)}` : formatDateTime(l.expiresAt)} · {l.downloadCount}
                  {l.maxDownloads ? `/${l.maxDownloads}` : ''} téléchargement(s)
                </p>
              </div>
              <Badge color={LINK_STATE_COLOR[l.state]}>{LINK_STATE_LABEL[l.state]}</Badge>
              {l.state === 'active' && (
                <Button variant="danger" size="sm" onClick={() => revoke(l)}>
                  Désactiver
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
