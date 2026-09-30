import { contentDisposition, sanitizeName, sniffMime, uniqueName } from './files';

describe('sanitizeName', () => {
  it('neutralise une tentative de remontée dans l’arborescence', () => {
    expect(sanitizeName('../../etc/passwd')).toBe('-..-etc-passwd');
    expect(sanitizeName('..\\..\\windows\\system32')).toBe('-..-windows-system32');
  });

  it('retire les caractères de contrôle et les espaces superflus', () => {
    expect(sanitizeName('  rapport\u0000 final\n.pdf ')).toBe('rapport final.pdf');
  });

  it('refuse un nom caché ou vide', () => {
    expect(sanitizeName('.env')).toBe('env');
    expect(sanitizeName('   ')).toBe('sans-nom');
  });

  it('garde les accents et limite la longueur', () => {
    expect(sanitizeName('Réunion d’été.docx')).toBe('Réunion d’été.docx');
    expect(sanitizeName('a'.repeat(300))).toHaveLength(200);
  });
});

describe('uniqueName', () => {
  it('numérote un doublon avant l’extension', () => {
    expect(uniqueName('rapport.pdf', ['rapport.pdf'])).toBe('rapport (1).pdf');
    expect(uniqueName('rapport.pdf', ['rapport.pdf', 'rapport (1).pdf'])).toBe('rapport (2).pdf');
  });

  it('compare sans tenir compte de la casse', () => {
    expect(uniqueName('Photo.PNG', ['photo.png'])).toBe('Photo (1).PNG');
  });

  it('gère un nom sans extension', () => {
    expect(uniqueName('Budget', ['Budget'])).toBe('Budget (1)');
  });
});

describe('sniffMime', () => {
  const bytes = (...b: number[]) => Buffer.from(b);

  it('reconnaît le type au contenu, pas au nom', () => {
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'image.txt')).toBe('image/png');
    expect(sniffMime(Buffer.from('%PDF-1.7'), 'document.png')).toBe('application/pdf');
  });

  it('traite un HTML ou un script renommé en image comme un binaire à télécharger', () => {
    expect(sniffMime(Buffer.from('<script>alert(1)</script>'), 'photo.jpg')).toBe('application/octet-stream');
    expect(sniffMime(Buffer.from('<!doctype html>'), 'page.html')).toBe('application/octet-stream');
  });

  it('accepte un texte seulement s’il ne contient pas d’octet nul', () => {
    expect(sniffMime(Buffer.from('a;b;c'), 'data.csv')).toBe('text/csv');
    expect(sniffMime(Buffer.from([0x61, 0x00, 0x62]), 'data.csv')).toBe('application/octet-stream');
  });
});

describe('contentDisposition', () => {
  it('fournit un nom ASCII de secours et le vrai nom encodé', () => {
    expect(contentDisposition('Été 2026.pdf')).toBe(`attachment; filename="Ete 2026.pdf"; filename*=UTF-8''%C3%89t%C3%A9%202026.pdf`);
  });

  it('empêche d’injecter un guillemet dans l’en-tête', () => {
    expect(contentDisposition('a"b.txt', true)).toMatch(/^inline; filename="a_b.txt"/);
  });
});
