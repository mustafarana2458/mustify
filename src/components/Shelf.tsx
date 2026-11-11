import { useId, type ReactNode } from 'react';
import type { HomeItem } from '../api/home';
import { HScroller } from './HScroller';
import { MediaCard, MediaCardSkeleton } from './MediaCard';

/*
 * Column count follows the container width (spec §3.3: "as many whole cards as fit",
 * min card ≈160–180px). Chosen thresholds, roughly one more column per ~200px.
 * Each card's width is 100%/cols, so a "page" scroll moves exactly one screen of cards.
 */
const COLS =
  '[--cols:2] @[460px]:[--cols:3] @[640px]:[--cols:4] @[840px]:[--cols:5] ' +
  '@[1040px]:[--cols:6] @[1260px]:[--cols:7] @[1480px]:[--cols:8] @[1700px]:[--cols:9]';

interface Props {
  title: string;
  items?: HomeItem[];
  loading?: boolean;
  /** Rendered instead of the cards (e.g. a "not available" placeholder). */
  children?: ReactNode;
}

/** A titled horizontal shelf of cards. Renders nothing when loaded and empty. */
export function Shelf({ title, items, loading, children }: Props) {
  const headingId = useId();
  if (!loading && !children && (!items || items.length === 0)) return null;

  return (
    <section aria-labelledby={headingId} className="@container mb-8">
      <h2 id={headingId} className="mb-1 text-2xl font-bold tracking-tight">
        {title}
      </h2>
      {children ?? (
        // -mx-3 lets the cards' own 12px padding line their text up with the heading.
        <HScroller label={title} variant="shelf" className="-mx-3" trackClassName={`grid grid-flow-col auto-cols-[calc(100%/var(--cols))] ${COLS}`}>
          {loading
            ? Array.from({ length: 8 }, (_, i) => <MediaCardSkeleton key={i} />)
            : items!.map((item) => <MediaCard key={item.key} item={item} />)}
        </HScroller>
      )}
    </section>
  );
}
