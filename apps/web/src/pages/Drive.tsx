import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { DetailsPanel } from '@/components/drive/DetailsPanel';
import { ItemMenu, type MenuAction } from '@/components/drive/ItemMenu';
import { MoveDialog, type MoveTarget } from '@/components/drive/MoveDialog';
import { ShareDialog, type ShareTarget } from '@/components/drive/ShareDialog';
import { UploadTray, type UploadJob } from '@/components/drive/UploadTray';
import { gsap, prefersReducedMotion, useGSAP } from '@/components/motion/gsap';
import { Scramble } from '@/components/motion/Scramble';
import { Modal } from '@/components/ui/modal';
import { Badge, Button, EmptyState, ErrorNote, Field, FileMark, FolderMark, Input, Kbd, Spinner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { api, downloadFile, errorMessage, uploadFiles } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canEdit, cx, formatBytes, ROLE_LABEL, timeAgo } from '@/lib/format';
import type { FileItem, FolderItem, FolderView } from '@/lib/types';
import { useApi } from '@/lib/use-api';

type Pending =
  | { kind: 'new-folder' }
  | { kind: 'rename'; target: { type: 'folder' | 'file'; id: string; name: string } }
  | { kind: 'delete'; target: { type: 'folder' | 'file'; id: string; name: string; count?: number } }
  | null;

type Row = { type: 'folder'; item: FolderItem } | { type: 'file'; item: FileItem };

let jobSeq = 0;

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || !!t.closest('dialog[open]');
};

/**
 * L'explorateur : un registre où chaque ligne est un dossier ou un fichier.
 * Il se parcourt au clavier (flèches, Entrée, retour arrière, « / » pour
 * filtrer) ; la ligne courante est inversée, comme un curseur de terminal.
 */
export default function Drive() {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { reload: reloadMe } = useAuth();
  const view = useApi<FolderView>(folderId ? `/folders/${folderId}` : '/drive');
  const [pending, setPending] = useState<Pending>(null);
  const [nameInput, setNameInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(-1);
  const fileInput = useRef<HTMLInputElement>(null);
  const filterInput = useRef<HTMLInputElement>(null);
  const table = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    setDetails(null);
    setCursor(-1);
    setSearch('');
  }, [folderId]);

  const role = view.data?.role ?? 'VIEWER';
  const editable = canEdit(role);
  const owner = role === 'OWNER';
  const refresh = useCallback(() => {
    void view.reload();
    void reloadMe();
  }, [view, reloadMe]);

  /* ------------------------------------------------------------ envois */

  async function send(files: File[]) {
    if (!editable || files.length === 0) return;
    // Envois groupés par 20 fichiers (limite de l'API), chacun avec sa barre de progression.
    for (let i = 0; i < files.length; i += 20) {
      const batch = files.slice(i, i + 20);
      const id = ++jobSeq;
      const bytes = batch.reduce((s, f) => s + f.size, 0);
      const label = batch.length === 1 ? batch[0].name : `${batch.length} fichiers`;
      setJobs((list) => [...list, { id, label, bytes, progress: 0, status: 'sending' }]);
      const form = new FormData();
      batch.forEach((f) => form.append('files', f, f.name));
      if (folderId) form.append('folderId', folderId);
      try {
        await uploadFiles(`/files`, form, (progress) => setJobs((list) => list.map((j) => (j.id === id ? { ...j, progress } : j))));
        setJobs((list) => list.map((j) => (j.id === id ? { ...j, status: 'done' } : j)));
      } catch (err) {
        setJobs((list) => list.map((j) => (j.id === id ? { ...j, status: 'error', error: errorMessage(err) } : j)));
      }
    }
    refresh();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!editable) {
      toast('error', 'Vous avez un accès en lecture seule à ce dossier.');
      return;
    }
    void send([...e.dataTransfer.files]);
  }

  /* ------------------------------------------------------------ actions */

  async function submitName(e: React.FormEvent) {
    e.preventDefault();
    if (!pending || pending.kind === 'delete') return;
    setBusy(true);
    setFormError(null);
    try {
      if (pending.kind === 'new-folder') {
        await api('/folders', { method: 'POST', json: { name: nameInput, parentId: folderId ?? null } });
      } else {
        const { type, id } = pending.target;
        await api(`/${type === 'folder' ? 'folders' : 'files'}/${id}`, { method: 'PATCH', json: { name: nameInput } });
      }
      setPending(null);
      refresh();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (pending?.kind !== 'delete') return;
    setBusy(true);
    try {
      const { type, id, name } = pending.target;
      await api(`/${type === 'folder' ? 'folders' : 'files'}/${id}`, { method: 'DELETE' });
      toast('success', `« ${name} » supprimé`);
      if (details === id) setDetails(null);
      setPending(null);
      refresh();
    } catch (err) {
      toast('error', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const ask = (p: Pending, initialName = '') => {
    setFormError(null);
    setNameInput(initialName);
    setPending(p);
  };

  function folderActions(f: FolderItem): MenuAction[] {
    const list: MenuAction[] = [{ label: 'Ouvrir', hint: '↵', onSelect: () => navigate(`/drive/${f.id}`) }];
    if (editable) list.push({ label: 'Renommer', onSelect: () => ask({ kind: 'rename', target: { type: 'folder', id: f.id, name: f.name } }, f.name) });
    if (owner) {
      list.push({ label: 'Partager', onSelect: () => setShareTarget({ kind: 'folder', id: f.id, name: f.name }) });
      list.push({ label: 'Déplacer', onSelect: () => setMoveTarget({ kind: 'folder', id: f.id, name: f.name, currentParentId: f.parentId }) });
    }
    if (editable) list.push({ label: 'Supprimer', danger: true, onSelect: () => ask({ kind: 'delete', target: { type: 'folder', id: f.id, name: f.name, count: f.itemCount } }) });
    return list;
  }

  function fileActions(f: FileItem): MenuAction[] {
    const list: MenuAction[] = [
      { label: 'Télécharger', onSelect: () => downloadFile(f.id).catch((e) => toast('error', errorMessage(e))) },
      { label: 'Détails', hint: '↵', onSelect: () => setDetails(f.id) },
    ];
    if (editable) list.push({ label: 'Renommer', onSelect: () => ask({ kind: 'rename', target: { type: 'file', id: f.id, name: f.name } }, f.name) });
    if (owner) {
      list.push({ label: 'Partager', onSelect: () => setShareTarget({ kind: 'file', id: f.id, name: f.name }) });
      list.push({ label: 'Déplacer', onSelect: () => setMoveTarget({ kind: 'file', id: f.id, name: f.name, currentParentId: f.folderId }) });
    }
    if (editable) list.push({ label: 'Supprimer', danger: true, onSelect: () => ask({ kind: 'delete', target: { type: 'file', id: f.id, name: f.name } }) });
    return list;
  }

  /* ------------------------------------------------------------ données */

  const data = view.data;
  const q = search.trim().toLowerCase();
  const rows: Row[] = [
    ...(data?.folders.filter((f) => !q || f.name.toLowerCase().includes(q)).map((item) => ({ type: 'folder' as const, item })) ?? []),
    ...(data?.files.filter((f) => !q || f.name.toLowerCase().includes(q)).map((item) => ({ type: 'file' as const, item })) ?? []),
  ];

  const open = useCallback(
    (row: Row) => (row.type === 'folder' ? navigate(`/drive/${row.item.id}`) : setDetails(row.item.id)),
    [navigate],
  );

  const goUp = useCallback(() => {
    if (!data?.folder) return;
    const crumbs = data.breadcrumbs;
    if (crumbs.length > 1) navigate(`/drive/${crumbs[crumbs.length - 2].id}`);
    else navigate(data.role === 'OWNER' ? '/drive' : '/partages');
  }, [data, navigate]);

  /* ------------------------------------------------------------ clavier */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !isTyping(e)) {
        e.preventDefault();
        filterInput.current?.focus();
        return;
      }
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setCursor((c) => Math.min(rows.length - 1, c + 1));
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === 'Enter' && rows[cursor]) {
        e.preventDefault();
        open(rows[cursor]);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        goUp();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, cursor, open, goUp]);

  // La ligne courante reste visible quand on la déplace au clavier.
  useEffect(() => {
    table.current?.querySelector(`[data-row="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  // Les lignes entrent l'une après l'autre à chaque changement de dossier.
  useGSAP(
    () => {
      if (!data || prefersReducedMotion()) return;
      gsap.from('[data-row]', { opacity: 0, x: -10, duration: 0.6, stagger: 0.025, clearProps: 'all' });
    },
    { scope: table, dependencies: [data?.folder?.id ?? 'root', !!data] },
  );

  /* ------------------------------------------------------------ rendu */

  const pathRoot = data?.folder && data.role !== 'OWNER' ? { to: '/partages', label: '~/partages' } : { to: '/drive', label: '~' };

  return (
    <div
      className="relative flex min-h-[70vh] flex-col gap-7"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <header className="flex flex-col gap-5 border-b border-line-strong pb-6">
        {/* Chemin : un invité commence au dossier qu'on lui a partagé. */}
        <nav className="flex min-w-0 flex-wrap items-center gap-x-1.5 font-mono text-[12px]" aria-label="Emplacement">
          <Link to={pathRoot.to} className="u-link text-faint hover:text-fg">
            {pathRoot.label}
          </Link>
          {data?.breadcrumbs.map((c, i) => (
            <span key={c.id} className="flex min-w-0 items-center gap-x-1.5">
              <span className="text-line-strong">/</span>
              {i === data.breadcrumbs.length - 1 ? (
                <span className="truncate text-muted">{c.name}</span>
              ) : (
                <Link to={`/drive/${c.id}`} className="u-link truncate text-faint hover:text-fg">
                  {c.name}
                </Link>
              )}
            </span>
          ))}
        </nav>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="display truncate text-3xl leading-none sm:text-5xl">{data?.folder?.name ?? 'Mes fichiers'}</h1>
            {data?.folder && data.role !== 'OWNER' ? (
              <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
                Partagé par {data.folder.ownerName} <Badge color="var(--color-seal)">{ROLE_LABEL[data.role]}</Badge>
              </p>
            ) : (
              data && (
                <p className="mt-3 font-mono text-[12px] text-muted">
                  {data.folders.length} dossier{data.folders.length > 1 ? 's' : ''} · {data.files.length} fichier{data.files.length > 1 ? 's' : ''}
                </p>
              )
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 items-center gap-2 border border-line-strong px-3 focus-within:border-fg">
              <span className="font-mono text-[12px] text-faint">/</span>
              <input
                ref={filterInput}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' || e.key === 'Enter') e.currentTarget.blur();
                }}
                placeholder="filtrer"
                className="w-28 bg-transparent font-mono text-[13px] outline-none placeholder:text-faint sm:w-40"
                aria-label="Filtrer ce dossier"
              />
            </label>
            {editable && (
              <>
                <Button variant="secondary" onClick={() => ask({ kind: 'new-folder' }, '')}>
                  + Dossier
                </Button>
                <Button onClick={() => fileInput.current?.click()}>Importer</Button>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    void send([...(e.target.files ?? [])]);
                    e.target.value = '';
                  }}
                />
              </>
            )}
            {owner && data?.folder && (
              <Button variant="secondary" onClick={() => setShareTarget({ kind: 'folder', id: data.folder!.id, name: data.folder!.name })}>
                Partager
              </Button>
            )}
          </div>
        </div>
      </header>

      {view.error && <ErrorNote>{view.error}</ErrorNote>}
      {view.loading && !data && <Spinner />}

      {data && rows.length === 0 && (
        <EmptyState
          title={q ? 'Aucun résultat.' : 'Dossier vide.'}
          text={q ? 'Aucun élément de ce dossier ne correspond au filtre.' : editable ? 'Glissez des fichiers ici, ou utilisez « Importer ». Chacun reçoit une empreinte SHA-256 à son arrivée.' : 'Rien à afficher pour l’instant.'}
        />
      )}

      <div ref={table}>
        {data && rows.length > 0 && (
          <div role="grid" aria-label="Contenu du dossier" className="border-t border-line-strong">
            <div className="hidden grid-cols-[3rem_1fr_7rem_9rem_9rem_2.5rem] gap-4 border-b border-line px-2 py-2 font-mono text-[10px] tracking-[0.14em] text-faint uppercase md:grid" role="row">
              <span>N°</span>
              <span>Nom</span>
              <span className="text-right">Taille</span>
              <span>Empreinte</span>
              <span>Modifié</span>
              <span />
            </div>
            {rows.map((row, i) => {
              const active = i === cursor;
              const f = row.item;
              return (
                <div
                  key={f.id}
                  data-row={i}
                  role="row"
                  aria-selected={active}
                  onMouseEnter={() => setCursor(i)}
                  className={cx(
                    'group grid grid-cols-[2rem_1fr_2.5rem] items-center gap-3 border-b border-line px-2 py-2 transition-colors duration-150 md:grid-cols-[3rem_1fr_7rem_9rem_9rem_2.5rem] md:gap-4',
                    active ? 'bg-fg text-ink' : details === f.id ? 'bg-surface-2' : '',
                  )}
                >
                  <span className={cx('font-mono text-[11px]', active ? 'text-ink/60' : 'text-faint')}>{String(i + 1).padStart(3, '0')}</span>
                  <button type="button" onClick={() => open(row)} className="flex min-w-0 items-center gap-3 text-left" role="gridcell">
                    {row.type === 'folder' ? <FolderMark shared={row.item.shared} size={30} /> : <FileMark mime={row.item.mimeType} name={row.item.name} size={30} />}
                    <span className="min-w-0">
                      <span className="block truncate text-[14px]">
                        {f.name}
                        {row.type === 'folder' && <span className={active ? 'text-ink/50' : 'text-faint'}>/</span>}
                      </span>
                      <span className={cx('block font-mono text-[11px] md:hidden', active ? 'text-ink/60' : 'text-muted')}>
                        {row.type === 'folder' ? `${row.item.itemCount} élément(s)` : formatBytes(row.item.size)}
                      </span>
                    </span>
                    {f.shared && row.type === 'file' && <span className="size-1.5 shrink-0 rounded-full bg-seal" aria-label="Partagé" />}
                  </button>
                  <span className={cx('hidden text-right font-mono text-[12px] md:block', active ? 'text-ink/70' : 'text-muted')}>
                    {row.type === 'folder' ? `${row.item.itemCount} él.` : formatBytes(row.item.size)}
                  </span>
                  <span className={cx('hidden truncate font-mono text-[12px] md:block', active ? 'text-ink/70' : 'text-faint')}>
                    {row.type === 'file' ? <Scramble text={row.item.sha256.slice(0, 12)} duration={0.9} delay={i * 0.02} /> : '—'}
                  </span>
                  <span className={cx('hidden font-mono text-[12px] md:block', active ? 'text-ink/70' : 'text-muted')}>{timeAgo(f.updatedAt)}</span>
                  <ItemMenu actions={row.type === 'folder' ? folderActions(row.item) : fileActions(row.item)} label={f.name} inverted={active} />
                </div>
              );
            })}
            <p className="mt-4 hidden flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] text-faint md:flex">
              <span>
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> parcourir
              </span>
              <span>
                <Kbd>Entrée</Kbd> ouvrir
              </span>
              <span>
                <Kbd>⌫</Kbd> dossier parent
              </span>
              <span>
                <Kbd>/</Kbd> filtrer
              </span>
              {editable && <span>— ou glissez des fichiers n’importe où</span>}
            </p>
          </div>
        )}
      </div>

      {dragging && (
        <div className="pointer-events-none absolute -inset-3 z-20 flex items-center justify-center border border-dashed border-fg bg-ink/90">
          <p className="display text-2xl">{editable ? 'Déposer pour importer et sceller' : 'Lecture seule : import impossible'}</p>
        </div>
      )}

      <Modal open={pending?.kind === 'new-folder' || pending?.kind === 'rename'} onClose={() => setPending(null)} title={pending?.kind === 'rename' ? 'Renommer' : 'Nouveau dossier'}>
        <form onSubmit={submitName} className="flex flex-col gap-5">
          {formError && <ErrorNote>{formError}</ErrorNote>}
          <Field label="Nom" htmlFor="item-name">
            <Input id="item-name" required maxLength={200} value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoFocus />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" loading={busy}>
              {pending?.kind === 'rename' ? 'Renommer' : 'Créer'}
            </Button>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Annuler
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={pending?.kind === 'delete'} onClose={() => setPending(null)} title="Supprimer définitivement ?">
        {pending?.kind === 'delete' && (
          <>
            <p className="text-sm leading-relaxed text-muted">
              <span className="text-fg">« {pending.target.name} »</span>
              {pending.target.type === 'folder' ? ` et tout son contenu (${pending.target.count ?? 0} élément(s) au premier niveau) seront supprimés` : ' sera supprimé'}, ainsi que ses partages et ses liens. Cette action est irréversible.
            </p>
            <div className="mt-6 flex gap-2">
              <Button variant="danger" onClick={confirmDelete} loading={busy}>
                Supprimer
              </Button>
              <Button variant="ghost" onClick={() => setPending(null)}>
                Annuler
              </Button>
            </div>
          </>
        )}
      </Modal>

      <ShareDialog target={shareTarget} onClose={() => setShareTarget(null)} onChanged={() => void view.reload()} />
      <MoveDialog
        target={moveTarget}
        onClose={() => setMoveTarget(null)}
        onMoved={() => {
          toast('success', 'Élément déplacé');
          refresh();
        }}
      />
      {details && <DetailsPanel fileId={details} onClose={() => setDetails(null)} onShare={(f) => setShareTarget({ kind: 'file', id: f.id, name: f.name })} />}
      <UploadTray jobs={jobs} onDismiss={() => setJobs([])} />
      {details && <button type="button" className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setDetails(null)} aria-label="Fermer les détails" />}
    </div>
  );
}
