import { ChevronRight, HardDrive } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button, ErrorNote, FolderMark, Spinner } from '@/components/ui/primitives';
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
 * Choix de la destination dans mon arborescence. Le dossier déplacé et tout
 * son contenu sont exclus de la liste : on ne peut pas ranger un dossier dans
 * lui-même (l'API le refuse aussi).
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
    const out: { folder: TreeFolder; depth: number }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const f of children.get(parentId) ?? []) {
        if (target?.kind === 'folder' && f.id === target.id) continue; // exclut le dossier et sa descendance
        out.push({ folder: f, depth });
        walk(f.id, depth + 1);
      }
    };
    walk(null, 0);
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

  const option = (id: string | null, label: React.ReactNode, depth: number, key: string) => (
    <li key={key}>
      <button
        type="button"
        onClick={() => setSelected(id)}
        aria-pressed={selected === id}
        disabled={id === target?.currentParentId}
        className={cx(
          'flex w-full items-center gap-2.5 rounded-lg py-2 pr-3 text-left text-sm transition-colors disabled:opacity-40',
          selected === id ? 'bg-gold-soft text-gold' : 'hover:bg-surface-2',
        )}
        style={{ paddingLeft: 12 + depth * 18 }}
      >
        {depth > 0 && <ChevronRight className="size-3 text-faint" />}
        {label}
      </button>
    </li>
  );

  return (
    <Modal open={target !== null} onClose={onClose} title={target ? `Déplacer « ${target.name} »` : ''}>
      {tree.loading && !tree.data ? (
        <Spinner />
      ) : (
        <ul className="max-h-80 overflow-y-auto rounded-xl border border-line p-1.5">
          {option(
            null,
            <>
              <HardDrive className="size-4 text-gold" /> Mes fichiers (racine)
            </>,
            0,
            'root',
          )}
          {rows.map(({ folder, depth }) =>
            option(
              folder.id,
              <>
                <FolderMark size={22} /> <span className="truncate">{folder.name}</span>
              </>,
              depth + 1,
              folder.id,
            ),
          )}
        </ul>
      )}
      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button onClick={move} loading={pending} disabled={selected === target?.currentParentId}>
          Déplacer ici
        </Button>
      </div>
    </Modal>
  );
}
