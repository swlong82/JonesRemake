import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'default' | 'ghost' | 'danger';

const styles: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-strong',
  default: 'bg-surface-2 text-ink hover:bg-surface-3 border border-line',
  ghost: 'bg-transparent text-ink hover:bg-surface-2',
  danger: 'bg-danger text-on-danger hover:opacity-90',
};

export function Button({
  variant = 'default',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`min-h-11 rounded-md px-4 py-2 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    />
  );
}
