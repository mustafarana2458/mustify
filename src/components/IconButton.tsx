import type { ButtonHTMLAttributes, Ref } from 'react';

type Size = 'sm' | 'md' | 'lg' | 'touch';

const sizes: Record<Size, string> = {
  sm: 'size-8', // 32px: player-bar transport size (UI-SPEC §3.1)
  md: 'size-10',
  lg: 'size-12', // 48px: control-size base
  touch: 'size-11', // 44px: minimum touch target on mobile
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: Size;
  /** Toggled-on state: accent colour plus a 4px dot under the icon (UI-SPEC §3.1). */
  active?: boolean;
  /** Filled circular surface (e.g. the top-bar Home button). */
  filled?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  label,
  size = 'sm',
  active,
  filled,
  className = '',
  children,
  ...rest
}: Props) {
  const tone = active
    ? 'text-accent-ink hover:brightness-110'
    : filled
      ? 'bg-elevated text-fg-muted hover:bg-elevated-hover hover:text-fg'
      : 'text-fg/70 hover:text-fg active:text-fg/70';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      className={
        `relative inline-flex shrink-0 items-center justify-center rounded-full ` +
        `transition-[color,background-color,transform] duration-150 ease-productive hover:duration-[50ms] ` +
        `hover:scale-[1.04] active:scale-100 disabled:pointer-events-none disabled:opacity-30 ` +
        `${sizes[size]} ${tone} ${className}`
      }
      {...rest}
    >
      {children}
      {active && (
        <span
          aria-hidden
          className="absolute bottom-0 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current"
        />
      )}
    </button>
  );
}
