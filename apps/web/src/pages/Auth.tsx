import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Logo } from '@/components/AppShell';
import { useEffect } from 'react';
import { Button, ErrorNote, Field, Input } from '@/components/ui/primitives';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** Comptes des données de démonstration (prisma/seed.ts), pour qu'un visiteur essaie chaque rôle. */
const DEMO = [
  { label: 'Léa', hint: 'propriétaire', email: 'demo@safeshare.dev' },
  { label: 'Karim', hint: 'éditeur invité', email: 'karim@safeshare.dev' },
  { label: 'Sofia', hint: 'lectrice invitée', email: 'sofia@safeshare.dev' },
];
const DEMO_PASSWORD = 'safeshare2026';

/** N'accepte qu'un chemin interne comme destination après connexion. */
function safeNext(raw: string | null) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : null;
}

function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-[radial-gradient(50rem_24rem_at_50%_-8%,rgba(242,181,68,0.12),transparent)] px-4 py-10">
      <Logo />
      <div className="mt-8 w-full max-w-md rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
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
    <AuthFrame title="Connexion" subtitle="Accédez à votre espace de fichiers.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <Field label="E-mail" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Mot de passe" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" loading={pending} className="mt-1">
          Se connecter
        </Button>
      </form>

      <div className="mt-6 rounded-2xl bg-surface-2/60 p-4">
        <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">Essayer un rôle de démonstration</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => {
                setEmail(d.email);
                setPassword(DEMO_PASSWORD);
              }}
              className="rounded-xl border border-line-strong bg-surface-2 px-2 py-2 text-center hover:border-gold hover:text-gold"
            >
              <span className="block text-[13px] font-semibold">{d.label}</span>
              <span className="block text-[11px] text-muted">{d.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Pas encore de compte ?{' '}
        <Link to={`/inscription${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-gold">
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
    <AuthFrame title="Créer un compte" subtitle="1 Go d’espace pour stocker et partager vos fichiers.">
      <form onSubmit={submit} className="flex flex-col gap-4">
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
          Créer mon compte
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Déjà inscrit ?{' '}
        <Link to="/connexion" className="font-semibold text-gold">
          Se connecter
        </Link>
      </p>
    </AuthFrame>
  );
}
