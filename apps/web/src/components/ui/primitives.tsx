import { forwardRef, useEffect, useState } from 'react';
import { cx, fileKind, type FileKind } from '@/lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

/*
 * Boutons d'inventaire : angles droits, libellés en capitales à chasse fixe.
 * Le principal est blanc ; au survol il prend la couleur de la cire.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-fg text-ink hover:bg-seal-strong',
  secondary: 'border border-line-strong text-fg hover:border-fg',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'border border-seal/70 text-seal hover:bg-seal hover:text-ink',
};
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[11px] gap-1.5',
  md: 'h-10 px-4 text-[12px] gap-2',
  lg: 'h-12 px-6 text-[13px] gap-2',
};

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', className?: string) =>
  cx(
    // Un bouton masqué sur mobile (« hidden sm:inline-flex ») ne doit pas recevoir
    // aussi « inline-flex » : dans la feuille de style, ce dernier l'emporterait.
    /(^|\s)hidden(\s|$)/.test(className ?? '') ? null : 'inline-flex',
    'items-center justify-center font-mono font-semibold tracking-[0.08em] uppercase whitespace-nowrap transition-colors duration-300 disabled:opacity-40 disabled:pointer-events-none select-none',
    VARIANTS[variant],
    SIZES[size],
    className,
  );

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Braille />}
      {children}
    </button>
  );
});

const fieldBase =
  'w-full border border-line-strong bg-surface px-3 font-mono text-[14px] text-fg placeholder:text-faint transition-colors hover:border-muted focus:border-fg focus:outline-none';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(fieldBase, 'h-11', className)} {...rest} />;
});

export function Select({ className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldBase, 'h-11 cursor-pointer pr-8', className)} {...rest} />;
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">
        {label}
      </label>
      {children}
      {hint && <p className="text-[13px] text-faint">{hint}</p>}
    </div>
  );
}

/** Étiquette d'inventaire : un mot entre crochets, dans la couleur donnée. Pas de pastille. */
export function Badge({ color, className, children }: { color: string; className?: string; children: React.ReactNode }) {
  return (
    <span className={cx('inline-flex items-center font-mono text-[11px] tracking-[0.08em] whitespace-nowrap uppercase', className)} style={{ color }}>
      [&nbsp;{children}&nbsp;]
    </span>
  );
}

/** Indicateur d'attente façon terminal : un caractère braille qui tourne. */
function Braille() {
  const frames = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % frames.length), 80);
    return () => clearInterval(t);
  }, []);
  return (
    <span aria-hidden className="font-mono">
      {frames[i]}
    </span>
  );
}

export function Spinner({ label = 'Chargement' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-16 font-mono text-[12px] tracking-[0.1em] text-muted uppercase" role="status">
      <Braille /> {label}…
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-l-2 border-seal py-1.5 pl-3 text-sm text-seal" role="alert">
      <span className="font-mono text-[11px] font-bold tracking-[0.1em]">ERR</span>
      <div>{children}</div>
    </div>
  );
}

/** État vide : un cadre en pointillés, un symbole « ensemble vide », une phrase. */
export function EmptyState({ title, text, action }: { icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-line-strong px-6 py-14">
      <p className="font-mono text-4xl text-faint">∅</p>
      <h3 className="display mt-4 text-xl">{title}</h3>
      {text && <p className="mt-2 max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const KIND_TAG: Record<FileKind, string> = {
  image: 'IMG',
  pdf: 'PDF',
  sheet: 'TAB',
  text: 'TXT',
  archive: 'ZIP',
  video: 'VID',
  other: 'BIN',
};

/** Repère d'un fichier : son extension dans une case, comme une cote d'archive. */
export function FileMark({ mime, name, size = 40 }: { mime: string; name: string; size?: number }) {
  const ext = name.includes('.') ? name.split('.').pop()!.slice(0, 4) : KIND_TAG[fileKind(mime, name)];
  return (
    <span
      className="flex shrink-0 items-center justify-center border border-line-strong font-mono font-semibold text-muted uppercase"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.24) }}
    >
      {ext}
    </span>
  );
}

/** Repère d'un dossier : une case pleine ; un point rouge s'il est partagé. */
export function FolderMark({ size = 40, shared = false }: { size?: number; shared?: boolean }) {
  return (
    <span className="relative flex shrink-0 items-center justify-center bg-surface-3 font-mono font-bold text-fg" style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}>
      /
      {shared && <span className="absolute -top-1 -right-1 size-2 rounded-full bg-seal" aria-label="Partagé" />}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="border border-line-strong px-1.5 py-0.5 font-mono text-[10px] text-muted">{children}</kbd>;
}

/** En-tête de page : le chemin en chasse fixe, puis le titre, puis un filet. */
export function PageHeader({ title, subtitle, actions, path }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; path?: string }) {
  return (
    <header className="flex flex-col gap-5 border-b border-line-strong pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {path && <p className="mb-3 font-mono text-[12px] text-faint">{path}</p>}
        <h1 className="display text-3xl leading-none sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
