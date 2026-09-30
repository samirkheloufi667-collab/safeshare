import { hashPassword, verifyPassword } from './password';

describe('mots de passe', () => {
  it('vérifie le bon mot de passe', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
  });

  it('refuse un mauvais mot de passe', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(await verifyPassword('Correct horse battery', stored)).toBe(false);
  });

  it('produit une empreinte différente à chaque fois grâce au sel', async () => {
    const [a, b] = await Promise.all([hashPassword('meme'), hashPassword('meme')]);
    expect(a).not.toBe(b);
  });

  it('ne stocke jamais le mot de passe en clair', async () => {
    const stored = await hashPassword('secret-visible');
    expect(stored).not.toContain('secret-visible');
    expect(stored.startsWith('scrypt$')).toBe(true);
  });

  it('refuse une empreinte mal formée sans lever d’erreur', async () => {
    expect(await verifyPassword('x', 'bcrypt$abc')).toBe(false);
    expect(await verifyPassword('x', 'n-importe-quoi')).toBe(false);
  });
});
