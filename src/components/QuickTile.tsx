import { Link } from 'react-router';
import type { HomeItem } from '../api/home';
import { Artwork } from './Artwork';
import { PlayButton } from './PlayButton';

/**
 * Quick-access tile (UI-SPEC §3.2): horizontal; square art the full tile height on the left,
 * title on the right. Tinted surface (white 10%), 4px radius, background transition 300ms,
 * hover/focus-within → stronger tint (~white 20%). A 32px play button fades in at the right edge on hover
 * (only for fine pointers, per spec), and stays visible while that context is playing.
 * Height comes from --tile-h set by the grid.
 *
 * Structure: the title link is "stretched" over the whole tile, and the play button sits
 * above it, so there is no button nested inside a link.
 */
export function QuickTile({ item }: { item: HomeItem }) {
  return (
    <div className="group/tile relative flex h-[var(--tile-h)] items-center gap-3 overflow-hidden rounded-sm bg-tint pr-2 transition-colors duration-300 hover:bg-tint-press has-[:focus-visible]:bg-tint-press">
      <Artwork
        images={item.images}
        liked={item.liked}
        px={80}
        className="aspect-square h-full shrink-0 rounded-none shadow-[0_8px_24px_#00000080]"
      />
      <Link to={item.to} className="line-clamp-2 min-w-0 flex-1 text-sm font-bold outline-none after:absolute after:inset-0">
        {item.title}
      </Link>
      {item.play && (
        <PlayButton
          target={item.play}
          label={item.title}
          size="sm"
          className="relative z-10 opacity-0 group-hover/tile:opacity-100 focus-visible:opacity-100 data-[playing]:opacity-100 pointer-coarse:hidden"
        />
      )}
    </div>
  );
}

export function QuickTileSkeleton() {
  return (
    <div className="flex h-[var(--tile-h)] items-center gap-3 overflow-hidden rounded-sm bg-tint" aria-hidden>
      <div className="aspect-square h-full bg-fg/10" />
      <div className="h-3 w-1/2 animate-pulse rounded-full bg-fg/10" />
    </div>
  );
}
