import { X } from 'lucide-react';
import { Link } from 'react-router';
import { useApi } from '../api/hooks';
import type { Artist } from '../api/types';
import { Artwork } from '../components/Artwork';
import { IconButton } from '../components/IconButton';
import { LikeButton } from '../components/LikeButton';
import { NotAvailableCard } from '../components/NotAvailableCard';
import { AttributionLine } from '../components/offline/OfflineTrackRow';
import { ScrollArea } from '../components/ScrollArea';
import { withViewTransition } from '../lib/viewTransition';
import { usePlayer } from '../player/store';
import { useLayout } from '../store/layout';
import { albumRoute, ArtistLinks } from './PlayerBar';

const QUEUE_PREVIEW = 5; // chosen

/**
 * Right "Now Playing" panel (UI-SPEC §1.5; data §5.8):
 *   cover/title/artists  ← playback state
 *   artist card          ← GET /artists/{id}  (image, name, followers if provided)
 *   artist bio, credits  ← ❌ no official endpoint → placeholder cards
 *   next in queue        ← GET /me/player/queue (or the SDK's next tracks when local)
 */
export function RightPanel() {
  const setRightOpen = useLayout((s) => s.setRightOpen);
  const item = usePlayer((s) => s.item);
  const queue = usePlayer((s) => s.queue);
  const mainArtistId = item?.kind === 'track' ? item.artists[0]?.id : null;
  const { data: artist } = useApi<Artist>(mainArtistId ? `/artists/${mainArtistId}` : null);
  const albumTo = item ? albumRoute(item) : null;

  return (
    <aside aria-label="Now playing" className="flex h-full min-w-0 flex-col">
      <header className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <h2 className="truncate font-bold">{item?.album.name || 'Now playing'}</h2>
        <IconButton label="Close now playing view" onClick={() => withViewTransition(() => setRightOpen(false))}>
          <X className="size-4" aria-hidden />
        </IconButton>
      </header>

      <ScrollArea className="flex-1">
        {!item ? (
          <p className="px-4 py-8 text-center text-sm text-fg-muted">
            Nothing playing. Press play on anything in Home, or pick a device with the Connect button.
          </p>
        ) : (
          <div className="space-y-4 px-4 pb-4">
            <Artwork images={item.album.images} px={400} className="aspect-square w-full rounded-lg shadow-card" />
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                {albumTo ? (
                  <Link to={albumTo} className="truncate text-2xl font-bold hover:underline">
                    {item.name}
                  </Link>
                ) : (
                  <span className="truncate text-2xl font-bold">{item.name}</span>
                )}
                <ArtistLinks item={item} className="text-fg-muted" />
              </div>
              {item.kind === 'track' && <LikeButton trackId={item.id} size="md" />}
            </div>

            {artist && (
              <section className="overflow-hidden rounded-lg bg-elevated">
                <div className="relative aspect-[16/10]">
                  <Artwork images={artist.images} px={360} className="size-full" />
                  <span className="absolute top-3 left-4 text-sm font-bold text-white drop-shadow-[0_1px_4px_#000]">About the artist</span>
                </div>
                <div className="p-4">
                  <Link to={`/artist/${artist.id}`} className="font-bold hover:underline">
                    {artist.name}
                  </Link>
                  {artist.followers?.total != null && (
                    <p className="text-sm text-fg-muted">{artist.followers.total.toLocaleString()} followers</p>
                  )}
                  <p className="mt-2 text-xs text-fg-muted">Artist bio is not available through the official Spotify Web API.</p>
                </div>
              </section>
            )}

            {item.kind === 'local' ? (
              item.attribution && (
                <section className="rounded-lg bg-elevated p-4">
                  <h3 className="mb-2 text-sm font-bold">Source &amp; licence</h3>
                  <AttributionLine attribution={item.attribution} className="text-sm" />
                </section>
              )
            ) : (
              <NotAvailableCard title="Credits" />
            )}

            {queue.length > 0 && (
              <section className="rounded-lg bg-elevated p-4">
                <h3 className="mb-3 text-sm font-bold">Next in queue</h3>
                {/* The Web API cannot jump to a queue entry, so rows are not clickable. */}
                <ul className="space-y-1">
                  {queue.slice(0, QUEUE_PREVIEW).map((q, i) => (
                    <li key={`${q.uri}-${i}`} className="flex items-center gap-3 rounded-md p-2">
                      <Artwork images={q.album.images} px={48} className="size-12 shrink-0 rounded-sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{q.name}</span>
                        <span className="block truncate text-xs text-fg-muted">{q.artists.map((a) => a.name).join(', ')}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
