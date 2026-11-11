import { Link } from 'react-router';
import type { HomeItem } from '../api/home';
import { Artwork } from './Artwork';
import { PlayButton } from './PlayButton';

/**
 * Shelf card (UI-SPEC §3.3): square art (round for artists), 1-line bold title,
 * 2-line subdued subtitle, hover → tinted background. A 48px play button slides up and
 * fades in at the bottom-right of the art on hover/focus; it stays while playing.
 * The title link is stretched over the card; the button sits above it (no nesting).
 */
export function MediaCard({ item }: { item: HomeItem }) {
  return (
    <div className="group/card relative flex snap-start flex-col gap-2 rounded-md p-3 transition-colors duration-150 hover:bg-tint hover:duration-[50ms] has-[:focus-visible]:bg-tint active:bg-tint-press">
      <div className="relative">
        <Artwork
          images={item.images}
          liked={item.liked}
          round={item.round}
          px={200}
          className="aspect-square w-full rounded-md shadow-[0_8px_24px_#00000080]"
        />
        {item.play && (
          <PlayButton
            target={item.play}
            label={item.title}
            className={
              'absolute right-2 bottom-2 z-10 translate-y-2 opacity-0 ' +
              'group-hover/card:translate-y-0 group-hover/card:opacity-100 ' +
              'focus-visible:translate-y-0 focus-visible:opacity-100 ' +
              'data-[playing]:translate-y-0 data-[playing]:opacity-100'
            }
          />
        )}
      </div>
      <span className="min-w-0">
        <Link to={item.to} className="block truncate text-[15px] font-bold outline-none after:absolute after:inset-0">
          {item.title}
        </Link>
        {item.subtitle && <span className="line-clamp-2 text-sm text-fg-muted">{item.subtitle}</span>}
      </span>
    </div>
  );
}

export function MediaCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3" aria-hidden>
      <div className="aspect-square w-full animate-pulse rounded-md bg-fg/10" />
      <div className="h-3 w-3/4 rounded-full bg-fg/10" />
      <div className="h-3 w-1/2 rounded-full bg-fg/10" />
    </div>
  );
}
