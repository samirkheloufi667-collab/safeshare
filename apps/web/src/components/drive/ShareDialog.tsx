import { motion } from 'motion/react';
import { useState } from 'react';
import { Scramble } from '@/components/motion/Scramble';
import { Seal } from '@/components/motion/Seal';
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
          <div className="mb-6 flex gap-6 border-b border-line" role="tablist">
            {[
              { id: 'people' as const, label: 'Personnes' },
              { id: 'links' as const, label: 'Lien public' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cx('relative py-2.5 font-mono text-[12px] tracking-[0.1em] uppercase transition-colors', tab === id ? 'text-fg' : 'text-faint hover:text-muted')}
              >
                {label}
                {tab === id && <motion.span layoutId="share-tab" className="absolute inset-x-0 -bottom-px h-[2px] bg-fg" transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} />}
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
const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

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
        <Button type="submit" loading={pending} className="h-11">
          Inviter
        </Button>
      </form>
      {error && <ErrorNote>{error}</ErrorNote>}
      {target.kind === 'folder' && <p className="text-[13px] text-muted">L’accès vaut pour tout le contenu du dossier, sous-dossiers compris. La personne ne voit pas les dossiers situés au-dessus.</p>}

      <ul className="border-t border-line-strong">
        {shares.data?.length === 0 && <li className="border-b border-line py-5 font-mono text-[12px] text-faint">— personne d’autre n’a accès.</li>}
        {shares.data?.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3">
            <span className="flex size-8 items-center justify-center border border-line-strong font-mono text-[11px] text-muted">{initials(s.user.name)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{s.user.name}</p>
              <p className="truncate font-mono text-[11px] text-muted">{s.user.email}</p>
            </div>
            {s.inheritedFrom ? (
              <p className="text-right">
                <Badge color="var(--color-muted)">{s.role === 'EDITOR' ? 'Peut modifier' : 'Lecture seule'}</Badge>
                <span className="mt-1 block font-mono text-[11px] text-faint">↳ hérité de « {s.inheritedFrom.name} »</span>
              </p>
            ) : (
              <>
                <Select value={s.role} onChange={(e) => update(s, e.target.value as ShareRole)} className="h-9 w-40 text-[13px]" aria-label={`Droits de ${s.user.name}`}>
                  <option value="VIEWER">Lecture seule</option>
                  <option value="EDITOR">Peut modifier</option>
                </Select>
                <button type="button" onClick={() => remove(s)} className="u-link font-mono text-[11px] tracking-[0.08em] text-muted uppercase hover:text-seal" aria-label={`Retirer l’accès de ${s.user.name}`}>
                  Retirer
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
    <div className="flex flex-col gap-6">
      {created?.url && (
        // Le sceau tombe sur le lien qui vient d'être créé : il ne sera plus jamais affiché.
        <div key={created.id} className="relative flex gap-5 border border-seal/60 p-4 pr-5">
          <Seal size={84} stamp label="LIEN · SCELLÉ · UNE FOIS · " />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] tracking-[0.12em] text-seal uppercase">Copiez ce lien maintenant</p>
            <p className="mt-1 text-[13px] text-muted">SafeShare n’en garde qu’une empreinte : il ne pourra plus être affiché.</p>
            <div className="mt-3 flex gap-2">
              <p className="min-w-0 flex-1 truncate border border-line-strong bg-ink px-3 py-2.5 font-mono text-[12px] select-all" aria-label="Lien de partage">
                <Scramble text={created.url} duration={1.1} delay={0.5} chars="abcdefghijklmnopqrstuvwxyz0123456789-_" />
              </p>
              <Button onClick={() => copy(created.url!)} variant={copied ? 'secondary' : 'primary'} className="h-auto">
                {copied ? 'Copié' : 'Copier'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={create} className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
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
          <Input id="l-max" type="number" min={1} max={1000} placeholder="illimité" value={form.maxDownloads} onChange={(e) => setForm({ ...form, maxDownloads: e.target.value })} />
        </Field>
        <Field label="Mot de passe (facultatif)" htmlFor="l-password" hint="À transmettre par un autre canal que le lien.">
          <Input id="l-password" type="password" autoComplete="new-password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Libellé (facultatif)" htmlFor="l-label" hint="Pour vous y retrouver : « Pour le comptable »…">
          <Input id="l-label" maxLength={80} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" loading={pending} className="mt-1">
            Créer et sceller le lien
          </Button>
        </div>
      </form>

      <div>
        <p className="mb-2 font-mono text-[11px] tracking-[0.12em] text-muted uppercase">Liens de cet élément</p>
        <ul className="border-t border-line-strong">
          {links.data?.length === 0 && <li className="border-b border-line py-5 font-mono text-[12px] text-faint">— aucun lien pour l’instant.</li>}
          {links.data?.map((l) => (
            <li key={l.id} className={cx('flex flex-wrap items-center gap-3 border-b border-line py-3', l.state !== 'active' && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm">
                  <span className="truncate">{l.label ?? 'Lien sans libellé'}</span>
                  {l.protected && <span className="font-mono text-[10px] text-seal">● MDP</span>}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-muted">
                  …{l.tokenHint} · {l.state === 'active' ? `expire ${timeAgo(l.expiresAt)}` : formatDateTime(l.expiresAt)} · {l.downloadCount}
                  {l.maxDownloads ? `/${l.maxDownloads}` : ''} tél.
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
