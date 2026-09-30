import { atLeast, strongest } from './access';
import { linkState } from './links';

const now = new Date('2026-10-01T12:00:00Z');
const base = { expiresAt: new Date('2026-10-02T12:00:00Z'), revokedAt: null, maxDownloads: null, downloadCount: 0 };

describe('linkState', () => {
  it('est actif avant expiration', () => {
    expect(linkState(base, now)).toBe('active');
  });

  it('expire à l’heure exacte', () => {
    expect(linkState({ ...base, expiresAt: now }, now)).toBe('expired');
  });

  it('est épuisé quand le nombre maximal de téléchargements est atteint', () => {
    expect(linkState({ ...base, maxDownloads: 3, downloadCount: 2 }, now)).toBe('active');
    expect(linkState({ ...base, maxDownloads: 3, downloadCount: 3 }, now)).toBe('exhausted');
  });

  it('une désactivation l’emporte sur tout le reste', () => {
    expect(linkState({ ...base, revokedAt: new Date('2026-09-30T00:00:00Z'), expiresAt: new Date('2026-09-01T00:00:00Z') }, now)).toBe('revoked');
  });
});

describe('rôles', () => {
  it('garde le rôle le plus fort parmi plusieurs partages', () => {
    expect(strongest(['VIEWER', 'EDITOR', 'VIEWER'])).toBe('EDITOR');
    expect(strongest([])).toBeNull();
  });

  it('ordonne lecteur < éditeur < propriétaire', () => {
    expect(atLeast('EDITOR', 'VIEWER')).toBe(true);
    expect(atLeast('VIEWER', 'EDITOR')).toBe(false);
    expect(atLeast('EDITOR', 'OWNER')).toBe(false);
    expect(atLeast('OWNER', 'EDITOR')).toBe(true);
  });
});
