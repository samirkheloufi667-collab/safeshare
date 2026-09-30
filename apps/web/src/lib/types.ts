export type ShareRole = 'VIEWER' | 'EDITOR';
export type Role = ShareRole | 'OWNER';
export type LinkState = 'active' | 'expired' | 'revoked' | 'exhausted';

export interface Me {
  id: string;
  email: string;
  name: string;
  quotaBytes: number;
  usedBytes: number;
  fileCount: number;
  createdAt: string;
}

export interface Crumb {
  id: string;
  name: string;
}

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  shared: boolean;
}

export interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  sha256: string;
  folderId: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  uploaderName: string;
  shared: boolean;
}

export interface FolderView {
  folder: (Crumb & { parentId: string | null; ownerId: string; ownerName: string }) | null;
  role: Role;
  breadcrumbs: Crumb[];
  folders: FolderItem[];
  files: FileItem[];
}

export interface FileDetail extends Omit<FileItem, 'uploaderName' | 'shared'> {
  role: Role;
  ownerName: string;
  uploaderName: string;
  breadcrumbs: Crumb[];
  previewable: boolean;
}

export interface Share {
  id: string;
  role: ShareRole;
  createdAt: string;
  user: { id: string; name: string; email: string };
  /** Dossier parent d'où vient l'accès, ou null pour un partage posé directement ici. */
  inheritedFrom: Crumb | null;
}

export interface SharedWithMe {
  id: string;
  role: ShareRole;
  sharedAt: string;
  grantedBy: string;
  folder: { id: string; name: string; updatedAt: string; itemCount: number } | null;
  file: { id: string; name: string; size: number; mimeType: string; updatedAt: string } | null;
}

export interface Link {
  id: string;
  tokenHint: string;
  label: string | null;
  expiresAt: string;
  maxDownloads: number | null;
  downloadCount: number;
  revokedAt: string | null;
  createdAt: string;
  protected: boolean;
  state: LinkState;
  folder: Crumb | null;
  file: Crumb | null;
  /** Présente uniquement dans la réponse de création : le lien complet n'est montré qu'une fois. */
  url?: string;
}

export interface PublicLink {
  state: LinkState;
  message: string | null;
  kind: 'file' | 'folder';
  name: string;
  sharedBy: string;
  label: string | null;
  expiresAt: string;
  protected: boolean;
  unlocked: boolean;
  remainingDownloads: number | null;
  files?: { id: string; name: string; size: number; mimeType: string; path: string; sha256?: string }[];
}

export interface ActivityEntry {
  id: string;
  action: string;
  targetName: string;
  targetType: 'file' | 'folder' | 'link';
  details: string | null;
  ip: string | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
}

export interface TreeFolder {
  id: string;
  name: string;
  parentId: string | null;
}
