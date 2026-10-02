import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button, ErrorNote, Spinner } from '@/components/ui/primitives';
import { api, errorMessage } from '@/lib/api';
import { cx } from '@/lib/format';
import type { TreeFolder } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export interface MoveTarget {
  kind: 'folder' | 'file';
  id: string;
  name: string;
  currentParentId: string | null;
}

/**
 * Choix de la destination dans mon arborescence, dessinée comme la sortie de
 * la commande `tree`. Le dossier déplacé et tout son contenu sont exclus : on
 * ne peut pas ranger un dossier dans lui-même (l'API le refuse aussi).
 */
export function MoveDialog({ target, onClose, onMoved }: { target: MoveTarget | null; onClose: () => void; onMoved: () => void }) {
  const tree = useApi<TreeFolder[]>(target ? '/folders-tree' : null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const rows = useMemo(() => {
    const all = tree.data ?? [];
    const children = new Map<string | null, TreeFolder[]>();
    all.forEach((f) => children.set(f.parentId, [...(children.get(f.parentId) ?? []), f]));
    const out: { folder: TreeFolder; prefix: string }[] = [];
    const walk = (parentId: string | null, prefix: string) => {
      const list = (children.get(parentId) ?? []).filter((f) => !(target?.kind === 'folder' && f.id === target.id));
      list.forEach((f, i) => {
        const last = i === list.length - 1;
        out.push({ folder: f, prefix: prefix + (last ? '└─ ' : '├─ ') });
        walk(f.id, prefix + (last ? '   ' : '│  '));
      });
    };
    walk(null, '');
    return out;
  }, [tree.data, target]);

  async function move() {
    if (!target) return;
    setPending(true);
    setError(null);
    try {
      const path = target.kind === 'folder' ? `/folders/${target.id}` : `/files/${target.id}`;
      await api(path, { method: 'PATCH', json: target.kind === 'folder' ? { parentId: selected } : { folderId: selected } });
      onMoved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const option = (id: string | null, prefix: string, label: string, key: string) => (
    <li key={key}>
      <button
        type="button"
        onClick={() => setSelected(id)}
        aria-pressed={selected === id}
        disabled={id === target?.currentParentId}
        className={cx('flex w-full items-center px-3 py-1.5 text-left font-mono text-[13px] whitespace-pre transition-colors disabled:opacity-35', selected === id ? 'bg-fg text-ink' : 'hover:bg-surface-2')}
      >
        <span className={selected === id ? 'text-ink/50' : 'text-faint'}>{prefix}</span>
        <span className="truncate">{label}</span>
      </button>
    </li>
  );

  return (
    <Modal open={target !== null} onClose={onClose} title={target ? `Déplacer « ${target.name} »` : ''}>
      {tree.loading && !tree.data ? (
        <Spinner />
      ) : (
        <ul className="max-h-80 overflow-y-auto border border-line-strong py-1.5">
          {option(null, '', '~/ (racine)', 'root')}
          {rows.map(({ folder, prefix }) => option(folder.id, prefix, `${folder.name}/`, folder.id))}
        </ul>
      )}
      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      <div className="mt-5 flex gap-2">
        <Button onClick={move} loading={pending} disabled={selected === target?.currentParentId}>
          Déplacer ici
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
      </div>
    </Modal>
  );
}
