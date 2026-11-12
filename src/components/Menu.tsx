import { Check, type LucideIcon } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';

export interface MenuItem {
  /** Stable key; defaults to label. */
  id?: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  /** Shows a check and accent colour (e.g. the active device). */
  checked?: boolean;
  /** Draws a divider above this item. */
  separatorBefore?: boolean;
}

interface MenuListProps {
  items: MenuItem[];
  header?: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
  /** refocus: return focus to whatever opened the menu. */
  onClose: (refocus: boolean) => void;
}

/**
 * The menu surface itself (UI-SPEC §3.7): elevated surface, 8px radius, 8px padding,
 * drop shadow, 160–350px wide, 12px item padding, elevated-hover on hover.
 * Keyboard: ArrowUp/Down/Home/End move, Enter/Space select, Escape/Tab close.
 * Shared by dropdown menus (<Menu>) and the right-click context menu.
 */
export const MenuList = forwardRef<HTMLDivElement, MenuListProps>(function MenuList(
  { items, header, className = '', style, id, onClose },
  ref,
) {
  const inner = useRef<HTMLDivElement | null>(null);
  const hasChecks = items.some((i) => i.checked !== undefined);

  const itemEls = () =>
    Array.from(inner.current?.querySelectorAll<HTMLButtonElement>('[role^=menuitem]:not(:disabled)') ?? []);

  useEffect(() => {
    (itemEls().find((el) => el.getAttribute('aria-checked') === 'true') ?? itemEls()[0])?.focus();
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const els = itemEls();
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    const focus = (n: number) => els[(n + els.length) % els.length]?.focus();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focus(i + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focus(i - 1);
        break;
      case 'Home':
        e.preventDefault();
        focus(0);
        break;
      case 'End':
        e.preventDefault();
        focus(els.length - 1);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onClose(true);
        break;
      case 'Tab':
        onClose(false);
        break;
    }
  };

  return (
    <div
      ref={(el) => {
        inner.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      id={id}
      role="menu"
      data-menu
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      style={style}
      className={
        // Short menus: native scroll (hidden bar) is enough here.
        `z-50 max-h-[calc(100vh-24px)] max-w-[350px] min-w-[160px] overflow-y-auto ` +
        `rounded-lg bg-elevated p-2 text-fg drop-shadow-[0_4px_6px_#0000004d] ${className}`
      }
    >
      {header && <div className="px-3 pt-2 pb-3">{header}</div>}
      {items.map(({ id: itemId, label, description, icon: Icon, onSelect, disabled, checked, separatorBefore }) => (
        <div key={itemId ?? label}>
          {separatorBefore && <hr className="mx-1 my-2 border-divider" />}
          <button
            type="button"
            role={hasChecks ? 'menuitemradio' : 'menuitem'}
            aria-checked={hasChecks ? !!checked : undefined}
            disabled={disabled}
            onClick={() => {
              onClose(true);
              onSelect();
            }}
            className={
              `flex min-h-10 w-full items-center gap-3 rounded-xs px-3 py-1.5 text-left text-sm ` +
              `hover:bg-elevated-hover focus-visible:bg-elevated-hover focus-visible:outline-none ` +
              `active:bg-elevated-press disabled:opacity-30 ${checked ? 'text-accent-ink' : ''}`
            }
          >
            {Icon && <Icon className={`size-5 shrink-0 ${checked ? '' : 'text-fg-muted'}`} aria-hidden />}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{label}</span>
              {description && <span className="block truncate text-xs text-fg-muted">{description}</span>}
            </span>
            {checked && <Check className="size-4 shrink-0" aria-hidden />}
          </button>
        </div>
      ))}
    </div>
  );
});

interface Props {
  items: MenuItem[];
  align?: 'start' | 'end';
  /** 'top' opens upward (for triggers near the bottom of the screen, like the player bar). */
  side?: 'top' | 'bottom';
  header?: ReactNode;
  onOpenChange?: (open: boolean) => void;
  /** Render prop for the trigger; spread the given props onto a <button>. */
  trigger: (props: {
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
    'aria-controls': string;
    onClick: () => void;
    ref: (el: HTMLButtonElement | null) => void;
    'data-context-menu-open'?: true;
  }) => ReactNode;
}

/** Dropdown menu anchored to a trigger button. */
export function Menu({ items, align = 'end', side = 'bottom', header, onOpenChange, trigger }: Props) {
  const [open, setOpenState] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const setOpen = (o: boolean) => {
    setOpenState(o);
    onOpenChangeRef.current?.(o);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !triggerRef.current?.contains(t)) {
        setOpenState(false);
        onOpenChangeRef.current?.(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  return (
    // flex (not block): a block wrapper around an inline-flex trigger adds a line box with
    // baseline space below it, which pushed triggers a few px off-centre in toolbars.
    <div className="relative flex shrink-0">
      {trigger({
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': id,
        onClick: () => setOpen(!open),
        ref: (el) => {
          triggerRef.current = el;
        },
        ...(open ? { 'data-context-menu-open': true as const } : {}),
      })}
      {open && (
        <MenuList
          ref={menuRef}
          id={id}
          items={items}
          header={header}
          onClose={(refocus) => {
            setOpen(false);
            if (refocus) triggerRef.current?.focus();
          }}
          className={
            'absolute ' + (side === 'top' ? 'bottom-full mb-2 ' : 'top-full mt-2 ') + (align === 'end' ? 'right-0' : 'left-0')
          }
        />
      )}
    </div>
  );
}
