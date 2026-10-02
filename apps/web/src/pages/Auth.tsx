import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Copyright, Logo } from '@/components/AppShell';
import { Scramble } from '@/components/motion/Scramble';
import { Seal } from '@/components/motion/Seal';
import { Button, ErrorNote, Field, Input } from '@/components/ui/primitives';
import { cx } from '@/lib/format';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** Comptes des données de démonstration (prisma/seed.ts), pour qu'un visiteur essaie chaque rôle. */
const DEMO = [
  { label: 'Léa Martin', hint: 'propriétaire', email: 'demo@safeshare.dev' },
  { label: 'Thomas Garnier', hint: 'éditeur invité', email: 'thomas@safeshare.dev' },
  { label: 'Sofia Rossi', hint: 'lectrice invitée', email: 'sofia@safeshare.dev' },
];
const DEMO_PASSWORD = 'safeshare2026';

/** N'accepte qu'un chemin interne comme destination après connexion. */
function safeNext(raw: string | null) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : null;
}

/** Page d'accès : à gauche le sceau qui tourne et le titre, à droite le formulaire. */
function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative flex flex-col justify-between border-line-strong p-6 sm:p-10 lg:border-r">
        <Logo />
        <div className="py-16 lg:py-0">
          <Seal size={150} spin className="mb-10 hidden lg:block" />
          <Scramble as="h1" text={title} chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" duration={0.9} className="display block text-5xl leading-[0.95] sm:text-6xl" />
          <p className="mt-5 max-w-sm text-muted">{subtitle}</p>
        </div>
        <Copyright className="hidden lg:block" />
      </div>
      <main className="flex flex-col justify-center px-6 pb-16 sm:px-10 lg:px-16">
        <div className="w-full max-w-md">{children}</div>
        <Copyright className="mt-12 lg:hidden" />
      </main>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(email, password);
      navigate(safeNext(params.get('next')) ?? '/drive', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  // « Essayer la démo » depuis l'accueil : le compte de Léa est prérempli.
  useEffect(() => {
    if (params.get('demo') === '1') {
      setEmail(DEMO[0].email);
      setPassword(DEMO_PASSWORD);
    }
  }, [params]);

  const next = params.get('next');
  return (
    <AuthFrame title="Accès au coffre" subtitle="Vos dossiers, vos partages et le journal de tout ce qui s’y passe.">
      <p className="font-mono text-[12px] text-faint">$ safeshare login</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
        {error && <ErrorNote>{error}</ErrorNote>}
        <Field label="E-mail" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Mot de passe" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" loading={pending} className="mt-1">
          Ouvrir
        </Button>
      </form>

      <div className="mt-10">
        <p className="border-b border-line-strong pb-2 font-mono text-[11px] tracking-[0.12em] text-muted uppercase">Comptes de démonstration</p>
        <ul>
          {DEMO.map((d) => {
            const selected = email === d.email && password === DEMO_PASSWORD;
            return (
              <li key={d.email}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(DEMO_PASSWORD);
                  }}
                  className={cx('flex w-full items-baseline justify-between gap-4 border-b border-line px-2 py-3 text-left transition-colors', selected ? 'bg-fg text-ink' : 'hover:bg-surface-2')}
                >
                  <span className="text-[14px]">{d.label}</span>
                  <span className={cx('font-mono text-[11px] uppercase', selected ? 'text-ink/60' : 'text-muted')}>{d.hint}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-8 text-sm text-muted">
        Pas encore de compte ?{' '}
        <Link to={`/inscription${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="u-link text-fg">
          Créer un compte
        </Link>
      </p>
    </AuthFrame>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await register(form);
      navigate(safeNext(params.get('next')) ?? '/drive', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <AuthFrame title="Nouveau coffre" subtitle="1 Go d’espace pour ranger, partager et suivre vos fichiers.">
      <p className="font-mono text-[12px] text-faint">$ safeshare init</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
        {error && <ErrorNote>{error}</ErrorNote>}
        <Field label="Prénom et nom" htmlFor="name" hint="Visible par les personnes avec qui vous partagez.">
          <Input id="name" autoComplete="name" required minLength={2} maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="E-mail" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Mot de passe" htmlFor="password" hint="10 caractères minimum.">
          <Input id="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Button type="submit" size="lg" loading={pending} className="mt-1">
          Créer mon coffre
        </Button>
      </form>
      <p className="mt-8 text-sm text-muted">
        Déjà inscrit ?{' '}
        <Link to="/connexion" className="u-link text-fg">
          Se connecter
        </Link>
      </p>
    </AuthFrame>
  );
}
