import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

interface SliderProps {
  /** 0..1 */
  value: number;
  /** Called continuously while dragging / on keyboard input. */
  onChange: (value: number) => void;
  /** Called once when a drag ends or a key is pressed (e.g. send the seek request). */
  onCommit?: (value: number) => void;
  label: string;
  valueText?: (value: number) => string;
  step?: number;
  className?: string;
  /** Not focusable, no pointer/keyboard input, no hover affordances. */
  disabled?: boolean;
}

/**
 * Seek / volume slider (UI-SPEC §3.6), my own implementation:
 * 4px track (white 30%), white fill drawn as a translated full-width bar,
 * hover preview (white 70%) up to the pointer, and on hover/focus/drag the fill turns
 * accent and a 12px thumb appears.
 */
export function Slider({
  value,
  onChange,
  onCommit,
  label,
  valueText,
  step = 0.05,
  className = '',
  disabled = false,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const latest = useRef(value);

  const ratioAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return clamp01((clientX - rect.left) / rect.width);
  };

  const update = (v: number) => {
    latest.current = v;
    onChange(v);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    update(ratioAt(e.clientX));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = ratioAt(e.clientX);
    if (dragging) update(r);
    else if (e.pointerType === 'mouse') setHover(r);
  };
  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    onCommit?.(latest.current);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + step * 2,
      PageDown: value - step * 2,
      Home: 0,
      End: 1,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const v = clamp01(keys[e.key]);
    update(v);
    onCommit?.(v);
  };

  const fill = `translateX(${(clamp01(value) - 1) * 100}%)`;

  if (disabled) {
    return (
      <div
        role="slider"
        aria-label={label}
        aria-disabled
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={valueText?.(value)}
        dir="ltr"
        className={`relative flex h-4 w-full cursor-default items-center ${className}`}
      >
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-fg/30">
          <div className="absolute inset-0 rounded-full bg-fg/40" style={{ transform: fill }} />
        </div>
      </div>
    );
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={valueText?.(value)}
      data-dragging={dragging || undefined}
      dir="ltr"
      className={`group relative flex h-4 w-full cursor-pointer touch-none items-center outline-none ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
    >
      <div
        ref={trackRef}
        className="relative h-1 w-full overflow-hidden rounded-full bg-fg/30 group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-accent-ink"
      >
        {hover !== null && !dragging && (
          <div
            className="absolute inset-0 rounded-full bg-fg/70"
            style={{ transform: `translateX(${(hover - 1) * 100}%)` }}
          />
        )}
        <div
          className="absolute inset-0 rounded-full bg-fg will-change-transform group-hover:bg-accent group-focus-visible:bg-accent group-data-[dragging]:bg-accent"
          style={{ transform: fill }}
        />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 -ml-1.5 hidden size-3 -translate-y-1/2 rounded-full bg-fg shadow-[0_2px_4px_#00000080] group-hover:block group-focus-visible:block group-data-[dragging]:block"
        style={{ left: `${clamp01(value) * 100}%` }}
      />
    </div>
  );
}
