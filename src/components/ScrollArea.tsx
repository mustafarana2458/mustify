import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type UIEvent,
} from 'react';

const INSET = 4; // spec §1.4: overlay scrollbar inset 4px top/bottom
const MIN_THUMB = 24; // chosen
const HIDE_AFTER_MS = 1000; // chosen: thumb fades out this long after scrolling stops

interface Props {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  /** Access to the scrolling element (sticky headers, scroll position, etc.). */
  viewportRef?: Ref<HTMLDivElement>;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

/**
 * Vertical scroll container with a thin overlay scrollbar (my own implementation).
 * The native scrollbar is hidden. A 6px thumb floats over the content and is visible
 * only while the area is hovered, being scrolled, or the thumb is being dragged.
 */
export function ScrollArea({ children, className = '', viewportClassName = '', viewportRef, onScroll }: Props) {
  const viewport = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [dragging, setDragging] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const drag = useRef<{ y: number; scrollTop: number; ratio: number } | null>(null);

  /** Positions the thumb imperatively (no re-render per scroll frame). */
  const layout = useCallback(() => {
    const v = viewport.current;
    const t = thumb.current;
    if (!v || !t) return;
    const { scrollHeight, clientHeight, scrollTop } = v;
    const has = scrollHeight > clientHeight + 1;
    setOverflowing(has);
    if (!has) return;
    const track = clientHeight - INSET * 2;
    const size = Math.max(MIN_THUMB, (track * clientHeight) / scrollHeight);
    const top = INSET + (track - size) * (scrollTop / (scrollHeight - clientHeight));
    t.style.height = `${size}px`;
    t.style.transform = `translateY(${top}px)`;
  }, []);

  useLayoutEffect(() => {
    layout();
    const ro = new ResizeObserver(layout);
    if (viewport.current) ro.observe(viewport.current);
    if (content.current) ro.observe(content.current);
    return () => ro.disconnect();
  }, [layout]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    layout();
    setScrolling(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setScrolling(false), HIDE_AFTER_MS);
    onScroll?.(e);
  };

  const onThumbDown = (e: PointerEvent<HTMLDivElement>) => {
    const v = viewport.current;
    if (!v || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const track = v.clientHeight - INSET * 2;
    const size = e.currentTarget.getBoundingClientRect().height;
    drag.current = {
      y: e.clientY,
      scrollTop: v.scrollTop,
      ratio: (v.scrollHeight - v.clientHeight) / Math.max(1, track - size),
    };
    setDragging(true);
  };
  const onThumbMove = (e: PointerEvent<HTMLDivElement>) => {
    const v = viewport.current;
    if (!v || !drag.current) return;
    v.scrollTop = drag.current.scrollTop + (e.clientY - drag.current.y) * drag.current.ratio;
  };
  const onThumbUp = () => {
    drag.current = null;
    setDragging(false);
  };

  const visible = overflowing && (scrolling || dragging);

  return (
    <div className={`group/scroll relative min-h-0 ${className}`}>
      <div
        ref={(el) => {
          viewport.current = el;
          assignRef(viewportRef, el);
        }}
        onScroll={handleScroll}
        className={`no-scrollbar h-full overflow-x-hidden overflow-y-auto ${viewportClassName}`}
      >
        {/* flow-root so child margins count toward the observed height */}
        <div ref={content} className="flow-root min-h-full">
          {children}
        </div>
      </div>
      <div
        ref={thumb}
        aria-hidden
        onPointerDown={onThumbDown}
        onPointerMove={onThumbMove}
        onPointerUp={onThumbUp}
        onPointerCancel={onThumbUp}
        className={
          `absolute top-0 right-0.5 z-20 w-1.5 touch-none rounded-full bg-fg/30 ` +
          `transition-[opacity,background-color] duration-200 hover:bg-fg/50 active:bg-fg/60 ` +
          (overflowing ? 'group-hover/scroll:opacity-100 ' : 'pointer-events-none ') +
          (visible ? 'opacity-100' : 'opacity-0')
        }
      />
    </div>
  );
}
