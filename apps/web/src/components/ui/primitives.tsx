import { FileArchive, FileImage, FileSpreadsheet, FileText, FileVideo, File as FileIconBase, Folder, LoaderCircle, TriangleAlert } from 'lucide-react';
import { forwardRef } from 'react';
import { cx, fileKind, type FileKind } from '@/lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gold text-ink hover:bg-gold-strong shadow-[0_8px_24px_-12px_rgba(242,181,68,0.7)]',
  secondary: 'bg-surface-2 text-fg border border-line-strong hover:border-muted/60 hover:bg-surface-3',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-danger/10 text-danger border border-danger/25 hover:bg-danger/20',
};
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl',
};

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', className?: string) =>
  cx(
    // Un bouton masqué sur mobile (« hidden sm:inline-flex ») ne doit pas recevoir
    // aussi « inline-flex » : dans la feuille de style, ce dernier l'emporterait.
    /(^|\s)hidden(\s|$)/.test(className ?? '') ? null : 'inline-flex',
    'items-center justify-center font-semibold whitespace-nowrap transition-colors disabled:opacity-45 disabled:pointer-events-none select-none',
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
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

const fieldBase =
  'w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-[15px] text-fg placeholder:text-faint transition-colors focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/10';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(fieldBase, 'h-11', className)} {...rest} />;
});

export function Select({ className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldBase, 'h-11 pr-8', className)} {...rest} />;
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

export function Badge({ color, className, children }: { color: string; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', className)}
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {children}
    </span>
  );
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted" role="status">
      <LoaderCircle className="size-5 animate-spin text-gold" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line-strong px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-gold-soft text-gold">{icon}</span>
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      {text && <p className="mt-1.5 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const KIND_STYLE: Record<FileKind, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  image: { icon: FileImage, color: '#c084fc' },
  pdf: { icon: FileText, color: '#f87171' },
  sheet: { icon: FileSpreadsheet, color: '#4ade80' },
  text: { icon: FileText, color: '#6ea8ff' },
  archive: { icon: FileArchive, color: '#fbbf24' },
  video: { icon: FileVideo, color: '#f472b6' },
  other: { icon: FileIconBase, color: '#9097a6' },
};

export function FileMark({ mime, name, size = 40 }: { mime: string; name: string; size?: number }) {
  const { icon: Icon, color } = KIND_STYLE[fileKind(mime, name)];
  return (
    <span className="flex shrink-0 items-center justify-center rounded-xl" style={{ width: size, height: size, color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}>
      <Icon className="size-[48%]" />
    </span>
  );
}

export function FolderMark({ size = 40, shared = false }: { size?: number; shared?: boolean }) {
  return (
    <span
      className={cx('flex shrink-0 items-center justify-center rounded-xl', shared ? 'bg-gold-soft text-gold' : 'bg-sky/12 text-sky')}
      style={{ width: size, height: size }}
    >
      <Folder className="size-[48%]" fill="currentColor" fillOpacity={0.25} />
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
