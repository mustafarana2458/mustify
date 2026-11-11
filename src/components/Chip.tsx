import { X } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

/**
 * Filter chip (UI-SPEC §3.4): pill, min height 32px, padding 4×12px, tinted surface.
 * Selected: the spec inverts the pill. This app uses the accent instead, so the chosen
 * accent colour shows up on active filters; on-accent keeps the text readable.
 */
export function Chip({
  selected,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={
        `inline-flex min-h-8 shrink-0 items-center rounded-full px-3 py-1 text-sm whitespace-nowrap ` +
        `transition-colors duration-150 ease-productive hover:duration-[50ms] ` +
        (selected
          ? 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-press '
          : 'bg-tint text-fg hover:bg-tint-hover active:bg-tint-press ') +
        className
      }
      {...rest}
    />
  );
}

export function ClearChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Clear filter"
      title="Clear filter"
      onClick={onClick}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-tint text-fg transition-colors duration-150 hover:bg-tint-hover hover:duration-[50ms] active:bg-tint-press"
    >
      <X className="size-4" aria-hidden />
    </button>
  );
}
