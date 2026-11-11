import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'tertiary';
type Size = 'sm' | 'md' | 'lg';

// Sizes and states follow UI-SPEC §3.1: pill shape, 32/48/56px min heights,
// fast hover-in (50ms) and 150ms settle, scale 1.04 on hover, disabled opacity .3.
const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap ' +
  'transition-[background-color,color,transform,box-shadow] duration-150 ease-productive ' +
  'hover:duration-[50ms] hover:scale-[1.04] active:scale-100 ' +
  'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-press',
  secondary:
    'bg-transparent text-fg shadow-[inset_0_0_0_1px_var(--color-icon-muted)] hover:shadow-[inset_0_0_0_1px_var(--color-fg)]',
  tertiary: 'bg-transparent text-fg-muted hover:text-fg',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-8 px-4 py-1 text-sm',
  md: 'min-h-12 px-6 py-1 text-base',
  lg: 'min-h-14 px-8 py-2 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest} />;
}
