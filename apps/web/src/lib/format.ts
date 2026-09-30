import type { LinkState, Role } from './types';

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

const UNITS = ['o', 'Ko', 'Mo', 'Go', 'To'];

/** 1 536 → « 1,5 Ko ». Unités françaises (octets). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: value < 10 ? 1 : 0 })} ${UNITS[unit]}`;
}

const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

export function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return seconds >= 0 ? 'dans un instant' : 'à l’instant';
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: 'Propriétaire',
  EDITOR: 'Peut modifier',
  VIEWER: 'Lecture seule',
};

export const canEdit = (role: Role) => role === 'OWNER' || role === 'EDITOR';

export const LINK_STATE_LABEL: Record<LinkState, string> = {
  active: 'Actif',
  expired: 'Expiré',
  revoked: 'Désactivé',
  exhausted: 'Limite atteinte',
};

export const LINK_STATE_COLOR: Record<LinkState, string> = {
  active: 'var(--color-ok)',
  expired: 'var(--color-faint)',
  revoked: 'var(--color-danger)',
  exhausted: 'var(--color-warn)',
};

export const DURATIONS = [
  { value: '1h', label: '1 heure' },
  { value: '24h', label: '24 heures' },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
];

/** Libellé lisible d'une entrée du journal. */
export const ACTION_LABEL: Record<string, string> = {
  upload: 'a importé',
  download: 'a téléchargé',
  'folder.create': 'a créé le dossier',
  rename: 'a renommé',
  move: 'a déplacé',
  delete: 'a supprimé',
  'share.grant': 'a partagé',
  'share.update': 'a modifié le partage de',
  'share.revoke': 'a retiré un accès à',
  'link.create': 'a créé un lien vers',
  'link.revoke': 'a désactivé un lien vers',
  'link.download': 'Téléchargement anonyme de',
  'link.password_failed': 'Mot de passe erroné sur un lien vers',
};

/** Famille d'un fichier, pour choisir son icône et sa couleur. */
export type FileKind = 'image' | 'pdf' | 'sheet' | 'text' | 'archive' | 'video' | 'other';

export function fileKind(mime: string, name: string): FileKind {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/zip') return 'archive';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['csv', 'xlsx', 'xls', 'ods'].includes(ext)) return 'sheet';
  if (mime.startsWith('text/') || ['md', 'txt', 'json', 'docx', 'odt'].includes(ext)) return 'text';
  if (['zip', 'rar', '7z', 'gz'].includes(ext)) return 'archive';
  return 'other';
}
