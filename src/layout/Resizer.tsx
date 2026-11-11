import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { KEYBOARD_RESIZE_STEP, PANEL_GAP } from '../store/layout';

interface Props {
  /** Which edge of the panel the handle sits on. */
  edge: 'end' | 'start';
  label: string;
  width: number;
  min: number;
  max: number;
  onResize: (requestedWidth: number) => void;
  onDragChange: (dragging: boolean) => void;
}

/**
 * Panel resize handle (UI-SPEC §1.3): an invisible bar filling the gap between panels,
 * fading in on hover (150ms ease-out), col-resize cursor. Also a keyboard-operable separator.
 */
export function Resizer({ edge, label, width, min, max, onResize, onDragChange }: Props) {
  const start = useRef<{ x: number; w: number } | null>(null);
  // Handle on the panel's end edge grows the panel when dragged right; on the start edge, left.
  const dir = edge === 'end' ? 1 : -1;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, w: width };
    onDragChange(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    onResize(start.current.w + (e.clientX - start.current.x) * dir);
  };
  const end = () => {
    if (!start.current) return;
    start.current = null;
    onDragChange(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const grow = e.key === (dir === 1 ? 'ArrowRight' : 'ArrowLeft');
    const shrink = e.key === (dir === 1 ? 'ArrowLeft' : 'ArrowRight');
    if (!grow && !shrink) return;
    e.preventDefault();
    onResize(width + (grow ? KEYBOARD_RESIZE_STEP : -KEYBOARD_RESIZE_STEP));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      style={{ width: PANEL_GAP, [edge === 'end' ? 'right' : 'left']: -PANEL_GAP }}
      className="group absolute inset-y-0 z-10 flex cursor-col-resize touch-none justify-center opacity-0 transition-opacity duration-150 ease-out hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
    >
      <span className="my-2 w-0.5 rounded-full bg-fg/40 group-active:bg-accent" />
    </div>
  );
}
