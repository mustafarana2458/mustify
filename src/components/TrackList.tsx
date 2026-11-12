import {
  CircleCheck,
  CirclePlus,
  Clock3,
  Disc3,
  Ellipsis,
  Link2,
  ListPlus,
  Pause,
  Play,
  UserRound,
} from 'lucide-react';
import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { Link, useNavigate, type NavigateFunction } from 'react-router';
import { getSavedTrack, setTrackSaved } from '../api/library';
import type { RowTrack } from '../api/normalize';
import { formatAdded, formatTime } from '../lib/format';
import { useNearBottom, useScrolledPast } from '../layout/mainScroll';
import { useSafeAreaTop } from '../lib/safeArea';
import { addToQueue, togglePlay } from '../player/controls';
import { usePlayer } from '../player/store';
import { toast } from '../store/toasts';
import { Artwork } from './Artwork';
import { openContextMenu } from './ContextMenu';
import { LikeButton } from './LikeButton';
import type { MenuItem } from './Menu';

/*
 * Track list (UI-SPEC §3.5). Rows are a CSS grid with named column lines:
 *   [index] [first] (title) [var1] (album) [var2] (date added) [last] (like · duration · more)
 * Columns drop out as the list gets narrower (spec: ≤600px keeps index/title/last).
 * Row height 56px (spec U5 unknown → chosen). Sticky 36px header that gets a background
 * once stuck. Hover = tint, selected = fg 30%, keyboard focus = 1px border.
 */

const ROW_H = 56; // chosen
const DOUBLE_CLICK_GUARD_MS = 400; // chosen
const ALBUM_MIN_WIDTH = 600; // spec: narrow container keeps only index/title/last
const ADDED_MIN_WIDTH = 860; // chosen

export interface TrackListProps {
  rows: RowTrack[];
  label: string;
  /** Start playback at this row. */
  onPlay: (row: RowTrack, index: number) => void;
  columns?: { cover?: boolean; album?: boolean; added?: boolean };
  showHeader?: boolean;
  /** Height of the sticky page bar above the list header (px), not counting the status-bar inset. */
  stickyTop?: number;
  totalCount?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

function Equalizer() {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="eq-bar h-full w-[3px] rounded-[1px] bg-accent-ink" style={{ animationDelay: `${i * -0.3}s` }} />
      ))}
    </span>
  );
}

export function trackMenuItems(rows: RowTrack[], navigate: NavigateFunction): MenuItem[] {
  if (rows.length > 1) {
    const uris = rows.filter((r) => r.playable).map((r) => r.uri);
    return [
      {
        label: `Add ${uris.length} songs to queue`,
        icon: ListPlus,
        disabled: uris.length === 0,
        onSelect: () => void addToQueue(uris),
      },
    ];
  }
  const r = rows[0];
  const items: MenuItem[] = [
    { label: 'Add to queue', icon: ListPlus, disabled: !r.playable, onSelect: () => void addToQueue([r.uri]) },
  ];
  if (r.kind === 'track' && r.id) {
    const saved = getSavedTrack(r.id);
    const id = r.id;
    items.push({
      label: saved === true ? 'Remove from Liked Songs' : 'Save to Liked Songs',
      icon: saved === true ? CircleCheck : CirclePlus,
      disabled: typeof saved !== 'boolean',
      onSelect: () => void setTrackSaved(id, saved !== true),
    });
  }
  const albumId = r.album?.id;
  if (albumId) {
    items.push({
      label: r.kind === 'episode' ? 'Go to podcast' : 'Go to album',
      icon: Disc3,
      separatorBefore: true,
      onSelect: () => navigate(r.kind === 'episode' ? `/show/${albumId}` : `/album/${albumId}`),
    });
  }
  const artists = r.kind === 'track' ? r.artists.filter((a) => a.id) : [];
  artists.forEach((a, i) =>
    items.push({
      id: `artist-${a.id}`,
      label: artists.length > 1 ? `Go to artist: ${a.name}` : 'Go to artist',
      icon: UserRound,
      separatorBefore: !albumId && i === 0,
      onSelect: () => navigate(`/artist/${a.id}`),
    }),
  );
  if (r.kind === 'track' && r.id) {
    const url = `https://open.spotify.com/track/${r.id}`;
    items.push({
      label: 'Copy song link',
      icon: Link2,
      separatorBefore: true,
      onSelect: () =>
        void navigator.clipboard.writeText(url).then(
          () => toast('Link copied.'),
          () => toast("Couldn't copy the link."),
        ),
    });
  }
  return items;
}

interface RowProps {
  row: RowTrack;
  index: number;
  template: string;
  showCover: boolean;
  showAlbum: boolean;
  showAdded: boolean;
  current: boolean;
  playing: boolean;
  selected: boolean;
  /** Joins the selection highlight with the selected row above/below (spec). */
  selectedAbove: boolean;
  selectedBelow: boolean;
  focusable: boolean;
  onRowClick: (e: MouseEvent, index: number) => void;
  onRowPlay: (index: number) => void;
  onRowKeyDown: (e: KeyboardEvent<HTMLDivElement>, index: number) => void;
  onRowMenu: (index: number, x: number, y: number, el: HTMLElement) => void;
  onRowFocus: (index: number) => void;
}

const TrackRow = memo(function TrackRow(p: RowProps) {
  const { row, index } = p;
  const playLabel = p.current && p.playing ? `Pause ${row.name}` : `Play ${row.name}`;

  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      aria-selected={p.selected}
      data-index={index}
      tabIndex={p.focusable ? 0 : -1}
      onFocus={() => p.onRowFocus(index)}
      onClick={(e) => p.onRowClick(e, index)}
      onKeyDown={(e) => p.onRowKeyDown(e, index)}
      onContextMenu={(e) => {
        e.preventDefault();
        p.onRowMenu(index, e.clientX, e.clientY, e.currentTarget);
      }}
      style={{ gridTemplateColumns: p.template, height: ROW_H }}
      className={
        'group grid cursor-default items-center gap-4 rounded-sm border border-transparent px-4 select-none ' +
        'focus-visible:border-fg focus-visible:outline-none ' +
        (p.selected ? 'bg-fg/30 ' : 'hover:bg-tint ') +
        (p.selectedAbove ? 'rounded-t-none ' : '') +
        (p.selectedBelow ? 'rounded-b-none ' : '') +
        (row.playable ? '' : 'opacity-50')
      }
    >
      {/* # / play / equaliser */}
      <div role="gridcell" className="flex justify-end text-fg-muted tabular-nums">
        <span
          className={
            `${row.playable ? 'group-hover:hidden group-focus-visible:hidden' : ''} ` +
            (p.current ? 'text-accent-ink' : '')
          }
        >
          {p.current && p.playing ? <Equalizer /> : index + 1}
        </span>
        {row.playable && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={playLabel}
            title={playLabel}
            onClick={(e) => {
              e.stopPropagation();
              if (p.current) void togglePlay();
              else p.onRowPlay(index);
            }}
            className="hidden text-fg group-hover:flex group-focus-visible:flex"
          >
            {p.current && p.playing ? <Pause className="size-4 fill-current" aria-hidden /> : <Play className="size-4 fill-current" aria-hidden />}
          </button>
        )}
      </div>

      {/* Title + artists */}
      <div role="gridcell" className="flex min-w-0 items-center gap-3">
        {p.showCover && <Artwork images={row.album?.images} px={40} className="size-10 shrink-0 rounded-xs" />}
        <div className="min-w-0">
          {/* Title opens the album (or podcast); artist names open the artist. */}
          <div className="truncate">
            {row.album?.id ? (
              <Link
                to={row.kind === 'episode' ? `/show/${row.album.id}` : `/album/${row.album.id}`}
                tabIndex={-1}
                className={`hover:underline ${p.current ? 'text-accent-ink' : 'text-fg'}`}
              >
                {row.name}
              </Link>
            ) : (
              <span className={p.current ? 'text-accent-ink' : 'text-fg'}>{row.name}</span>
            )}
          </div>
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-fg-muted">
            {row.explicit && (
              <span title="Explicit" className="shrink-0 rounded-[2px] bg-fg-muted px-1 text-[10px] leading-4 font-bold text-surface">
                E
              </span>
            )}
            <span className="truncate">
              {row.artists.map((a, i) => (
                <Fragment key={`${a.uri}-${i}`}>
                  {i > 0 && ', '}
                  {a.id && row.kind === 'track' ? (
                    <Link to={`/artist/${a.id}`} tabIndex={-1} className="group-hover:text-fg hover:underline">
                      {a.name}
                    </Link>
                  ) : (
                    a.name
                  )}
                </Fragment>
              ))}
            </span>
          </div>
        </div>
      </div>

      {p.showAlbum && (
        <div role="gridcell" className="min-w-0 truncate text-sm text-fg-muted">
          {row.album?.id ? (
            <Link
              to={row.kind === 'episode' ? `/show/${row.album.id}` : `/album/${row.album.id}`}
              tabIndex={-1}
              className="group-hover:text-fg hover:underline"
            >
              {row.album.name}
            </Link>
          ) : (
            row.album?.name
          )}
        </div>
      )}

      {p.showAdded && (
        <div role="gridcell" className="truncate text-sm text-fg-muted">
          {formatAdded(row.addedAt)}
        </div>
      )}

      {/* Like · duration · more */}
      <div role="gridcell" className="flex items-center justify-end gap-2">
        {row.kind === 'track' ? <LikeButton trackId={row.id} reveal /> : <span className="size-8" aria-hidden />}
        <span className="min-w-10 text-right text-sm text-fg-muted tabular-nums">{formatTime(row.durationMs)}</span>
        <button
          type="button"
          tabIndex={-1}
          aria-label={`More options for ${row.name}`}
          title="More options"
          onClick={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            p.onRowMenu(index, r.left, r.bottom + 4, e.currentTarget.closest('[role=row]') as HTMLElement);
          }}
          className="flex size-8 items-center justify-center text-fg-muted opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 hover:text-fg pointer-coarse:size-11 pointer-coarse:opacity-100"
        >
          <Ellipsis className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
});

export function TrackList({
  rows,
  label,
  onPlay,
  columns = {},
  showHeader = true,
  stickyTop = 64,
  totalCount,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: TrackListProps) {
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [headerSentinel, setHeaderSentinel] = useState<HTMLDivElement | null>(null);
  const [endSentinel, setEndSentinel] = useState<HTMLDivElement | null>(null);
  // The sticky header sits below the page bar AND the status-bar area (installed iPhone app).
  const safeTop = useSafeAreaTop();
  const stickyOffset = stickyTop + safeTop;
  const stuck = useScrolledPast(headerSentinel, stickyOffset);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [focusIndex, setFocusIndex] = useState(0);
  const anchor = useRef<number | null>(null);

  const nowUri = usePlayer((s) => s.item?.uri ?? null);
  const nowId = usePlayer((s) => s.item?.id ?? null);
  const isPlaying = usePlayer((s) => s.isPlaying);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useNearBottom(endSentinel, () => onLoadMore?.(), hasMore && !loadingMore && !!onLoadMore);

  // Clicking anywhere else (except an open menu) clears the selection.
  useEffect(() => {
    if (selected.size === 0) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!root.current?.contains(t) && !t.closest('[data-menu]')) setSelected(new Set());
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [selected.size]);

  const showCover = !!columns.cover;
  const showAlbum = !!columns.album && width >= ALBUM_MIN_WIDTH;
  const showAdded = !!columns.added && width >= ADDED_MIN_WIDTH;
  const count = totalCount ?? rows.length;
  const indexWidth = Math.max(16, String(count).length * 9);
  const template = showAdded
    ? `[index] ${indexWidth}px [first] minmax(120px, 6fr) [var1] minmax(120px, 4fr) [var2] minmax(120px, 3fr) [last] minmax(120px, 1fr)`
    : showAlbum
      ? `[index] ${indexWidth}px [first] minmax(120px, 4fr) [var1] minmax(120px, 2fr) [last] minmax(120px, 1fr)`
      : `[index] ${indexWidth}px [first] minmax(120px, 1fr) [last] minmax(120px, auto)`;

  // Latest values for the stable row callbacks below.
  const latest = useRef({ rows, selected, onPlay });
  latest.current = { rows, selected, onPlay };

  const onRowPlay = useCallback((index: number) => {
    const { rows: rs, onPlay: play } = latest.current;
    const row = rs[index];
    // Clicking the row that's already current resumes it if paused, instead of restarting.
    const s = usePlayer.getState();
    if (row.uri === s.item?.uri || (row.id !== null && row.id === s.item?.id)) {
      if (!s.isPlaying) void togglePlay();
      return;
    }
    play(row, index);
  }, []);

  const focusRow = (i: number) => {
    root.current?.querySelector<HTMLElement>(`[role=row][data-index="${i}"]`)?.focus();
  };

  const lastPlayClick = useRef<{ index: number; at: number } | null>(null);

  /**
   * Plain click / tap plays the row. Ctrl/⌘-click toggles it in the selection and Shift-click
   * selects a range. Clicks on links (title → album, artist → artist) and buttons inside
   * the row do their own thing.
   */
  const onRowClick = useCallback((e: MouseEvent, index: number) => {
    const { rows: rs, selected: sel } = latest.current;
    const key = rs[index].key;
    if ((e.target as HTMLElement).closest('a, button')) return;
    const multi = e.shiftKey || e.ctrlKey || e.metaKey;
    if (!multi) {
      anchor.current = index;
      if (sel.size) setSelected(new Set());
      if (!rs[index].playable) return;
      // A double-click arrives as two clicks; don't send the same play request twice.
      const now = Date.now();
      const last = lastPlayClick.current;
      if (last && last.index === index && now - last.at < DOUBLE_CLICK_GUARD_MS) return;
      lastPlayClick.current = { index, at: now };
      onRowPlay(index);
      return;
    }
    if (e.shiftKey && anchor.current !== null) {
      const [a, b] = [anchor.current, index].sort((x, y) => x - y);
      setSelected(new Set(rs.slice(a, b + 1).map((r) => r.key)));
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(sel);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setSelected(next);
      anchor.current = index;
    } else {
      setSelected(new Set([key]));
      anchor.current = index;
    }
  }, [onRowPlay]);

  const onRowMenu = useCallback(
    (index: number, x: number, y: number, el: HTMLElement) => {
      const { rows: rs, selected: sel } = latest.current;
      const row = rs[index];
      // Right-clicking outside the selection selects just that row (common list behaviour).
      let target = rs.filter((r) => sel.has(r.key));
      if (!sel.has(row.key)) {
        setSelected(new Set([row.key]));
        anchor.current = index;
        target = [row];
      }
      openContextMenu(x, y, trackMenuItems(target, navigate), el);
    },
    [navigate],
  );

  const onRowKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, index: number) => {
      const { rows: rs } = latest.current;
      const move = (to: number) => {
        if (to < 0 || to >= rs.length) return;
        e.preventDefault();
        if (e.shiftKey && anchor.current !== null) {
          const [a, b] = [anchor.current, to].sort((x, y) => x - y);
          setSelected(new Set(rs.slice(a, b + 1).map((r) => r.key)));
        } else {
          setSelected(new Set([rs[to].key]));
          anchor.current = to;
        }
        focusRow(to);
      };
      switch (e.key) {
        case 'ArrowDown':
          return move(index + 1);
        case 'ArrowUp':
          return move(index - 1);
        case 'Home':
          return move(0);
        case 'End':
          return move(rs.length - 1);
        case 'Enter':
          e.preventDefault();
          if (rs[index].playable) onRowPlay(index);
          return;
        case 'Escape':
          setSelected(new Set());
          return;
        case 'ContextMenu': {
          e.preventDefault();
          const r = e.currentTarget.getBoundingClientRect();
          onRowMenu(index, r.left + 48, r.bottom, e.currentTarget);
          return;
        }
      }
      if (e.key === 'F10' && e.shiftKey) {
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        onRowMenu(index, r.left + 48, r.bottom, e.currentTarget);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelected(new Set(rs.map((r) => r.key)));
      }
    },
    [onRowMenu, onRowPlay],
  );

  const onRowFocus = useCallback((index: number) => setFocusIndex(index), []);

  return (
    <div ref={root} role="grid" aria-label={label} aria-rowcount={count + (showHeader ? 1 : 0)} aria-multiselectable>
      {showHeader && (
        <>
          <div ref={setHeaderSentinel} className="h-px" aria-hidden />
          <div
            role="row"
            aria-rowindex={1}
            className={`sticky z-10 -mx-6 mb-2 px-6 transition-colors duration-150 ${stuck ? 'bg-surface-hover shadow-[0_1px_0_var(--color-divider)]' : ''}`}
            style={{ top: stickyOffset }}
          >
            <div
              className="grid h-9 items-center gap-4 border-b border-fg/10 px-4 text-sm text-fg-muted"
              style={{ gridTemplateColumns: template }}
            >
              <span role="columnheader" className="justify-self-end">
                #
              </span>
              <span role="columnheader">Title</span>
              {showAlbum && <span role="columnheader">Album</span>}
              {showAdded && <span role="columnheader">Date added</span>}
              <span role="columnheader" className="mr-10 flex justify-end" aria-label="Duration">
                <Clock3 className="size-4" aria-hidden />
              </span>
            </div>
          </div>
        </>
      )}

      <div role="rowgroup">
        {rows.map((row, i) => {
          const isCurrent = row.uri === nowUri || (row.id !== null && row.id === nowId);
          const sel = selected.has(row.key);
          return (
            <TrackRow
              key={row.key}
              row={row}
              index={i}
              template={template}
              showCover={showCover}
              showAlbum={showAlbum}
              showAdded={showAdded}
              current={isCurrent}
              playing={isCurrent && isPlaying}
              selected={sel}
              selectedAbove={sel && i > 0 && selected.has(rows[i - 1].key)}
              selectedBelow={sel && i < rows.length - 1 && selected.has(rows[i + 1].key)}
              focusable={i === Math.min(focusIndex, rows.length - 1)}
              onRowClick={onRowClick}
              onRowPlay={onRowPlay}
              onRowKeyDown={onRowKeyDown}
              onRowMenu={onRowMenu}
              onRowFocus={onRowFocus}
            />
          );
        })}
      </div>

      {hasMore && (
        <div ref={setEndSentinel} className="py-4 text-center text-sm text-fg-muted">
          {loadingMore ? 'Loading more…' : ''}
        </div>
      )}
    </div>
  );
}
