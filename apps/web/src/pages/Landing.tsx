import { Activity, ArrowRight, Clock, Fingerprint, FolderTree, KeyRound, Users } from 'lucide-react';
import { Link } from 'react-router';
import { Logo } from '@/components/AppShell';
import DecryptedText from '@/components/reactbits/DecryptedText';
import LetterGlitch from '@/components/reactbits/LetterGlitch';
import ShinyText from '@/components/reactbits/ShinyText';
import SpotlightCard from '@/components/reactbits/SpotlightCard';
import { buttonClass } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth';

const FEATURES = [
  { icon: FolderTree, title: 'Arborescence', text: 'Dossiers et sous-dossiers, glisser-déposer, déplacement, renommage, doublons numérotés automatiquement.' },
  { icon: Users, title: 'Permissions héritées', text: 'Partagez un dossier en lecture ou en modification : tout ce qu’il contient suit, à n’importe quelle profondeur.' },
  { icon: Clock, title: 'Liens qui expirent', text: 'Un lien public dure une heure, un jour ou un mois — puis il cesse de fonctionner, sans que vous y pensiez.' },
  { icon: KeyRound, title: 'Mot de passe et limites', text: 'Protégez un lien par mot de passe, limitez le nombre de téléchargements, désactivez-le d’un clic.' },
  { icon: Activity, title: 'Journal d’activité', text: 'Chaque import, téléchargement, partage et essai de mot de passe raté est inscrit, avec l’heure et l’adresse.' },
  { icon: Fingerprint, title: 'Intégrité vérifiable', text: 'Chaque fichier reçoit une empreinte SHA-256 : on peut prouver qu’il n’a pas été modifié.' },
];

export default function Landing() {
  const { me } = useAuth();
  return (
    <div className="min-h-svh">
      <section className="relative overflow-hidden border-b border-line">
        {/* Fond React Bits « LetterGlitch », très atténué : l'idée d'un contenu chiffré, sans gêner la lecture. */}
        <div className="pointer-events-none absolute inset-0 opacity-25" aria-hidden>
          <LetterGlitch
            glitchColors={['#3a3222', '#f2b544', '#6b5423']}
            glitchSpeed={70}
            centerVignette
            outerVignette
            smooth
            backgroundColor="#0a0b0d"
            characters="0123456789abcdef"
          />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(40rem_22rem_at_30%_40%,rgba(10,11,13,0.92),rgba(10,11,13,0.55))]" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-8">
          <div className="flex h-16 items-center justify-between">
            <Logo />
            <Link to={me ? '/drive' : '/connexion'} className={buttonClass('secondary')}>
              {me ? 'Mon espace' : 'Connexion'}
            </Link>
          </div>
          <div className="max-w-3xl pt-20 pb-28 sm:pt-28 sm:pb-36">
            <span className="inline-flex items-center rounded-full border border-gold/30 bg-gold-soft px-3.5 py-1.5 text-[13px] font-medium">
              <ShinyText text="Partage de fichiers sécurisé" color="#c9a25a" shineColor="#fff3d6" speed={3} />
            </span>
            <h1 className="mt-6 font-display text-5xl leading-[1.02] font-bold tracking-tight sm:text-7xl">
              <DecryptedText text="Vos fichiers." animateOn="view" sequential speed={40} encryptedClassName="text-gold/50" />
              <br />
              <span className="text-gold">
                <DecryptedText text="Vos règles." animateOn="view" sequential speed={40} encryptedClassName="text-gold/40" />
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Rangez vos documents, décidez qui peut les voir ou les modifier, et envoyez des liens qui expirent tout seuls. Chaque accès laisse une trace.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to={me ? '/drive' : '/inscription'} className={buttonClass('primary', 'lg')}>
                {me ? 'Ouvrir mon espace' : 'Créer un compte'} <ArrowRight className="size-4" />
              </Link>
              {!me && (
                <Link to="/connexion?demo=1" className={buttonClass('secondary', 'lg')}>
                  Essayer la démo
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Pensé pour ce qui ne doit pas fuiter.</h2>
        <p className="mt-3 max-w-2xl text-muted">Contrats, factures, maquettes client : SafeShare applique les bonnes pratiques de sécurité par défaut, pour que vous n’ayez pas à y penser.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <SpotlightCard key={title} className="p-6" spotlightColor="rgba(242, 181, 68, 0.14)">
              <span className="flex size-10 items-center justify-center rounded-xl bg-gold-soft text-gold">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
            </SpotlightCard>
          ))}
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-faint sm:flex-row sm:justify-between sm:px-8">
          <span>SafeShare — projet de démonstration (portfolio). Données fictives.</span>
          <span>React · Node.js · Express · PostgreSQL · JWT</span>
        </div>
      </footer>
    </div>
  );
}
