import { SearchX } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router';
import { AppShell } from '@/components/AppShell';
import { buttonClass, EmptyState, Spinner } from '@/components/ui/primitives';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/lib/auth';

// Pages chargées à la demande : la page publique d'un lien reste très légère.
const Landing = lazy(() => import('@/pages/Landing'));
const Login = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.Register })));
const Drive = lazy(() => import('@/pages/Drive'));
const Shared = lazy(() => import('@/pages/Shared'));
const Links = lazy(() => import('@/pages/Links'));
const ActivityPage = lazy(() => import('@/pages/ActivityPage'));
const PublicLink = lazy(() => import('@/pages/PublicLink'));

function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20">
      <EmptyState
        icon={<SearchX className="size-5" />}
        title="Page introuvable"
        text="Cette adresse ne correspond à aucune page de SafeShare."
        action={
          <Link to="/" className={buttonClass('secondary')}>
            Retour à l’accueil
          </Link>
        }
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route index element={<Landing />} />
              <Route path="connexion" element={<Login />} />
              <Route path="inscription" element={<Register />} />
              <Route path="l/:token" element={<PublicLink />} />
              <Route element={<AppShell />}>
                <Route path="drive" element={<Drive />} />
                <Route path="drive/:folderId" element={<Drive />} />
                <Route path="partages" element={<Shared />} />
                <Route path="liens" element={<Links />} />
                <Route path="activite" element={<ActivityPage />} />
                <Route path="app" element={<Navigate to="/drive" replace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
