import { ChevronRight, Download, Eye, FolderInput, FolderPlus, HardDrive, Info, Pencil, Search, Share2, Trash2, Upload, Users, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { DetailsPanel } from '@/components/drive/DetailsPanel';
import { ItemMenu, type MenuAction } from '@/components/drive/ItemMenu';
import { MoveDialog, type MoveTarget } from '@/components/drive/MoveDialog';
import { ShareDialog, type ShareTarget } from '@/components/drive/ShareDialog';
import { UploadTray, type UploadJob } from '@/components/drive/UploadTray';
import { Modal } from '@/components/ui/modal';
import { Badge, Button, EmptyState, ErrorNote, Field, FileMark, FolderMark, Input, Spinner } from '@/components/ui/primitives';
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

let jobSeq = 0;

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
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => setDetails(null), [folderId]);

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
    const list: MenuAction[] = [{ label: 'Ouvrir', icon: Eye, onSelect: () => navigate(`/drive/${f.id}`) }];
    if (editable) list.push({ label: 'Renommer', icon: Pencil, onSelect: () => ask({ kind: 'rename', target: { type: 'folder', id: f.id, name: f.name } }, f.name) });
    if (owner) {
      list.push({ label: 'Partager', icon: Share2, onSelect: () => setShareTarget({ kind: 'folder', id: f.id, name: f.name }) });
      list.push({ label: 'Déplacer', icon: FolderInput, onSelect: () => setMoveTarget({ kind: 'folder', id: f.id, name: f.name, currentParentId: f.parentId }) });
    }
    if (editable) list.push({ label: 'Supprimer', icon: Trash2, danger: true, onSelect: () => ask({ kind: 'delete', target: { type: 'folder', id: f.id, name: f.name, count: f.itemCount } }) });
    return list;
  }

  function fileActions(f: FileItem): MenuAction[] {
    const list: MenuAction[] = [
      { label: 'Télécharger', icon: Download, onSelect: () => downloadFile(f.id).catch((e) => toast('error', errorMessage(e))) },
      { label: 'Détails', icon: Info, onSelect: () => setDetails(f.id) },
    ];
    if (editable) list.push({ label: 'Renommer', icon: Pencil, onSelect: () => ask({ kind: 'rename', target: { type: 'file', id: f.id, name: f.name } }, f.name) });
    if (owner) {
      list.push({ label: 'Partager', icon: Share2, onSelect: () => setShareTarget({ kind: 'file', id: f.id, name: f.name }) });
      list.push({ label: 'Déplacer', icon: FolderInput, onSelect: () => setMoveTarget({ kind: 'file', id: f.id, name: f.name, currentParentId: f.folderId }) });
    }
    if (editable) list.push({ label: 'Supprimer', icon: Trash2, danger: true, onSelect: () => ask({ kind: 'delete', target: { type: 'file', id: f.id, name: f.name } }) });
    return list;
  }

  /* ------------------------------------------------------------ rendu */

  const data = view.data;
  const q = search.trim().toLowerCase();
  const folders = data?.folders.filter((f) => !q || f.name.toLowerCase().includes(q)) ?? [];
  const files = data?.files.filter((f) => !q || f.name.toLowerCase().includes(q)) ?? [];

  return (
    <div
      className="relative flex min-h-[70vh] flex-col gap-6"
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
      {/* Fil d'Ariane : un invité commence au dossier qu'on lui a partagé. */}
      <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm" aria-label="Emplacement">
        {data?.folder && data.role !== 'OWNER' ? (
          <Link to="/partages" className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-muted hover:bg-surface-2 hover:text-fg">
            <Users className="size-4" /> Partagés avec moi
          </Link>
        ) : (
          <Link to="/drive" className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-muted hover:bg-surface-2 hover:text-fg">
            <HardDrive className="size-4" /> Mes fichiers
          </Link>
        )}
        {data?.breadcrumbs.map((c, i) => (
          <span key={c.id} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="size-3.5 shrink-0 text-faint" />
            {i === data.breadcrumbs.length - 1 ? (
              <span className="truncate px-2 py-1 font-semibold">{c.name}</span>
            ) : (
              <Link to={`/drive/${c.id}`} className="truncate rounded-lg px-2 py-1 text-muted hover:bg-surface-2 hover:text-fg">
                {c.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">{data?.folder?.name ?? 'Mes fichiers'}</h1>
          {data?.folder && data.role !== 'OWNER' && (
            <p className="mt-1.5 flex items-center gap-2 text-sm text-muted">
              Partagé par {data.folder.ownerName} <Badge color="var(--color-gold)">{ROLE_LABEL[data.role]}</Badge>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrer…" className="h-10 w-full pl-9 sm:w-48" aria-label="Filtrer ce dossier" />
          </div>
          {editable && (
            <>
              <Button variant="secondary" onClick={() => ask({ kind: 'new-folder' }, '')}>
                <FolderPlus className="size-4" /> Dossier
              </Button>
              <Button onClick={() => fileInput.current?.click()}>
                <Upload className="size-4" /> Importer
              </Button>
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
              <Share2 className="size-4" /> Partager
            </Button>
          )}
        </div>
      </div>

      {view.error && <ErrorNote>{view.error}</ErrorNote>}
      {view.loading && !data && <Spinner />}

      {data && folders.length === 0 && files.length === 0 && (
        <EmptyState
          icon={<Upload className="size-5" />}
          title={q ? 'Aucun résultat' : 'Ce dossier est vide'}
          text={q ? 'Aucun élément de ce dossier ne correspond.' : editable ? 'Glissez des fichiers ici, ou utilisez le bouton « Importer ».' : 'Rien à afficher pour l’instant.'}
        />
      )}

      {data && (folders.length > 0 || files.length > 0) && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="hidden grid-cols-[1fr_120px_140px_44px] gap-4 border-b border-line px-4 py-2.5 text-xs font-medium tracking-wide text-faint uppercase sm:grid">
            <span>Nom</span>
            <span>Taille</span>
            <span>Modifié</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {folders.map((f) => (
              <li key={f.id} className="group grid grid-cols-[1fr_44px] items-center gap-4 px-4 py-2.5 transition-colors hover:bg-surface-2 sm:grid-cols-[1fr_120px_140px_44px]">
                <Link to={`/drive/${f.id}`} className="flex min-w-0 items-center gap-3">
                  <FolderMark shared={f.shared} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium group-hover:text-gold">{f.name}</span>
                    <span className="block text-xs text-muted sm:hidden">{f.itemCount} élément(s)</span>
                  </span>
                  {f.shared && <Share2 className="size-3.5 shrink-0 text-gold" aria-label="Partagé" />}
                </Link>
                <span className="hidden text-sm text-muted sm:block">{f.itemCount} élément(s)</span>
                <span className="hidden text-sm text-muted sm:block">{timeAgo(f.updatedAt)}</span>
                <ItemMenu actions={folderActions(f)} label={f.name} />
              </li>
            ))}
            {files.map((f) => (
              <li
                key={f.id}
                className={cx('group grid grid-cols-[1fr_44px] items-center gap-4 px-4 py-2.5 transition-colors hover:bg-surface-2 sm:grid-cols-[1fr_120px_140px_44px]', details === f.id && 'bg-surface-2')}
              >
                <button type="button" onClick={() => setDetails(f.id)} className="flex min-w-0 items-center gap-3 text-left">
                  <FileMark mime={f.mimeType} name={f.name} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium group-hover:text-gold">{f.name}</span>
                    <span className="block font-mono text-xs text-muted sm:hidden">{formatBytes(f.size)}</span>
                  </span>
                  {f.shared && <Share2 className="size-3.5 shrink-0 text-gold" aria-label="Partagé" />}
                </button>
                <span className="hidden font-mono text-sm text-muted sm:block">{formatBytes(f.size)}</span>
                <span className="hidden text-sm text-muted sm:block">{timeAgo(f.updatedAt)}</span>
                <ItemMenu actions={fileActions(f)} label={f.name} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-3xl border-2 border-dashed border-gold bg-ink/85 backdrop-blur-sm">
          <div className="text-center">
            <Upload className="mx-auto size-8 text-gold" />
            <p className="mt-3 font-display text-lg font-semibold">{editable ? 'Déposez pour importer ici' : 'Lecture seule : import impossible'}</p>
          </div>
        </div>
      )}

      <Modal open={pending?.kind === 'new-folder' || pending?.kind === 'rename'} onClose={() => setPending(null)} title={pending?.kind === 'rename' ? 'Renommer' : 'Nouveau dossier'}>
        <form onSubmit={submitName} className="flex flex-col gap-4">
          {formError && <ErrorNote>{formError}</ErrorNote>}
          <Field label="Nom" htmlFor="item-name">
            <Input id="item-name" required maxLength={200} value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPending(null)}>
              Annuler
            </Button>
            <Button type="submit" loading={busy}>
              {pending?.kind === 'rename' ? 'Renommer' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={pending?.kind === 'delete'} onClose={() => setPending(null)} title="Supprimer définitivement ?">
        {pending?.kind === 'delete' && (
          <>
            <p className="text-sm text-muted">
              « {pending.target.name} »
              {pending.target.type === 'folder' ? ` et tout son contenu (${pending.target.count ?? 0} élément(s) au premier niveau) seront supprimés` : ' sera supprimé'}, ainsi que ses partages
              et ses liens. Cette action est irréversible.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPending(null)}>
                Annuler
              </Button>
              <Button variant="danger" onClick={confirmDelete} loading={busy}>
                <Trash2 className="size-4" /> Supprimer
              </Button>
            </div>
          </>
        )}
      </Modal>

      <ShareDialog target={shareTarget} onClose={() => setShareTarget(null)} onChanged={() => void view.reload()} />
      <MoveDialog target={moveTarget} onClose={() => setMoveTarget(null)} onMoved={() => { toast('success', 'Élément déplacé'); refresh(); }} />
      {details && (
        <DetailsPanel
          fileId={details}
          onClose={() => setDetails(null)}
          onShare={(f) => setShareTarget({ kind: 'file', id: f.id, name: f.name })}
        />
      )}
      <UploadTray jobs={jobs} onDismiss={() => setJobs([])} />
      {details && <button type="button" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setDetails(null)} aria-label="Fermer les détails">
        <X className="sr-only" />
      </button>}
    </div>
  );
}
