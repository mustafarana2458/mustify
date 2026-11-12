import { AlertCircle, Check, Download, Ellipsis, Pause, Play } from 'lucide-react';
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { localToggle } from '../../offline/engine';
import { clearDownloadError, useOffline } from '../../offline/store';
import { offlineUri, type Attribution, type License, type Playable } from '../../offline/types';
import { formatTime } from '../../lib/format';
import { usePlayer } from '../../player/store';
import { Artwork } from '../Artwork';
import { Tooltip } from '../Tooltip';

/** Cover URL for a playable: remote right away, or a stored cover loaded on demand. */
export function useCover(p: Playable): string | undefined {
  const [loaded, setLoaded] = useState<{ id: string; url?: string } | null>(null);
  const getCover = p.getCover;
  // Keyed by track id (not the object): lists rebuild their Playable objects on every render.
  useEffect(() => {
    if (p.coverUrl || !getCover) return;
    let cancelled = false;
    void getCover().then((url) => !cancelled && setLoaded({ id: p.id, url }));
    return () => {
      cancelled = true;
    };
    // getCover is recreated on every render, so it's deliberately not a dependency.
  }, [p.id, p.coverUrl]);
  return p.coverUrl ?? (loaded?.id === p.id ? loaded.url : undefined);
}

export function LicenseChip({ license }: { license: License }) {
  return (
    <a
      href={license.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Licence: ${license.name}`}
      className="shrink-0 rounded-xs border border-fg/25 px-1 text-[10px] leading-4 font-bold text-fg-muted hover:border-fg hover:text-fg"
    >
      {license.name}
    </a>
  );
}

/**
 * Save-offline control: ⬇ (allowed), progress ring while downloading, filled ✓ when saved,
 * retry on error. Renders nothing when the source doesn't allow downloading.
 */
export function DownloadButton({ id, allowed, onDownload }: { id: string; allowed: boolean; onDownload: () => void }) {
  const downloaded = useOffline((s) => s.tracks.some((t) => t.id === id));
  const dl = useOffline((s) => s.downloads[id]);
  const stop = (e: MouseEvent) => e.stopPropagation();

  if (downloaded) {
    return (
      <Tooltip label="Downloaded">
        <span role="img" aria-label="Downloaded" className="flex size-11 items-center justify-center">
          <span className="flex size-5 items-center justify-center rounded-full bg-accent-ink text-on-accent-ink">
            <Check className="size-3" strokeWidth={4} aria-hidden />
          </span>
        </span>
      </Tooltip>
    );
  }
  if (!allowed) return null;
  if (dl?.status === 'downloading' || dl?.status === 'saving') {
    const pct = dl.total ? Math.round((dl.loaded / dl.total) * 100) : 0;
    const r = 8;
    const c = 2 * Math.PI * r;
    return (
      <span
        role="progressbar"
        aria-label={`Downloading ${dl.title}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={dl.total ? pct : undefined}
        className="flex size-11 items-center justify-center"
        onClick={stop}
      >
        <svg viewBox="0 0 20 20" className={`size-5 -rotate-90 ${dl.total ? '' : 'animate-spin'}`} aria-hidden>
          <circle cx="10" cy="10" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
          <circle
            cx="10"
            cy="10"
            r={r}
            fill="none"
            stroke="var(--color-accent-ink)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={dl.total ? c * (1 - pct / 100) : c * 0.7}
          />
        </svg>
      </span>
    );
  }
  if (dl?.status === 'error') {
    return (
      <Tooltip label={`Retry: ${dl.error ?? 'download failed'}`}>
        <button
          type="button"
          aria-label={`Download failed. Retry ${dl.title}`}
          onClick={(e) => {
            stop(e);
            clearDownloadError(id);
            onDownload();
          }}
          className="flex size-11 items-center justify-center text-danger"
        >
          <AlertCircle className="size-5" aria-hidden />
        </button>
      </Tooltip>
    );
  }
  return (
    <Tooltip label="Save offline">
      <button
        type="button"
        aria-label="Save offline"
        onClick={(e) => {
          stop(e);
          onDownload();
        }}
        className="flex size-11 items-center justify-center text-fg-muted transition-colors hover:text-fg"
      >
        <Download className="size-5" aria-hidden />
      </button>
    </Tooltip>
  );
}

/** "by Artist on Jamendo ↗ · CC BY 3.0" for Now Playing views. */
export function AttributionLine({ attribution: a, className = '' }: { attribution: Attribution; className?: string }) {
  return (
    <p className={`flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-fg-muted ${className}`}>
      {a.url ? (
        <a href={a.url} target="_blank" rel="noopener noreferrer" className="hover:text-fg hover:underline">
          {a.text}
        </a>
      ) : (
        <span>{a.text}</span>
      )}
      {a.license && <LicenseChip license={a.license} />}
    </p>
  );
}

interface RowProps {
  playable: Playable;
  index: number;
  onPlay: () => void;
  /** Can't be played (e.g. stream-gated, or offline without a download). */
  unavailable?: string;
  /** Download button / extra controls. */
  actions?: ReactNode;
  /** Opens the row's ⋯ menu at a position. */
  onMenu?: (x: number, y: number, el: HTMLElement) => void;
}

/**
 * Track row for the Offline section. Tap/click plays (inside the app). Shows title, artist,
 * where it's from (linked) and its licence, so attribution is always visible.
 */
export function OfflineTrackRow({ playable: p, index, onPlay, unavailable, actions, onMenu }: RowProps) {
  const cover = useCover(p);
  const current = usePlayer((s) => s.item?.uri === offlineUri(p.id));
  const playing = usePlayer((s) => s.isPlaying) && current;
  const a = p.attribution;

  const activate = (e?: MouseEvent) => {
    if (e && (e.target as HTMLElement).closest('a, button')) return;
    if (unavailable) return;
    if (current) localToggle();
    else onPlay();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${playing ? 'Pause' : 'Play'} ${p.title} by ${p.artist}`}
      aria-disabled={!!unavailable || undefined}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      }}
      onContextMenu={(e) => {
        if (!onMenu) return;
        e.preventDefault();
        onMenu(e.clientX, e.clientY, e.currentTarget);
      }}
      className={
        'group grid min-h-16 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-sm px-2 py-1 select-none ' +
        'transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 ' +
        (unavailable ? 'cursor-default opacity-50' : 'cursor-pointer hover:bg-tint active:bg-tint-press')
      }
    >
      <span className="relative size-11">
        <Artwork images={cover ? [{ url: cover, width: null, height: null }] : []} px={44} className="size-11 rounded-xs" />
        {!unavailable && (
          <span
            aria-hidden
            className={`absolute inset-0 flex items-center justify-center rounded-xs bg-black/50 text-white transition-opacity ${current ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          >
            {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
          </span>
        )}
      </span>

      <span className="min-w-0">
        <span className={`block truncate ${current ? 'text-accent-ink' : 'text-fg'}`}>
          <span className="sr-only">{index + 1}. </span>
          {p.title}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-fg-muted">
          <span className="truncate">{p.artist}</span>
          {a?.url && (
            <>
              <span aria-hidden>·</span>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 hover:text-fg hover:underline"
                title={a.text}
              >
                {p.source === 'jamendo' ? 'Jamendo' : p.source === 'audius' ? 'Audius' : 'Source'}
              </a>
            </>
          )}
          {p.source === 'local' && <span className="shrink-0">· Your file</span>}
          {a?.license && <LicenseChip license={a.license} />}
        </span>
        {unavailable && <span className="block text-xs text-fg-muted">{unavailable}</span>}
      </span>

      <span className="flex items-center gap-1">
        {actions}
        <span className="hidden min-w-10 text-right text-sm text-fg-muted tabular-nums sm:inline">
          {p.durationMs ? formatTime(p.durationMs) : ''}
        </span>
        {onMenu && (
          <button
            type="button"
            aria-label={`More options for ${p.title}`}
            onClick={(e) => {
              e.stopPropagation();
              const r = e.currentTarget.getBoundingClientRect();
              onMenu(r.left, r.bottom + 4, e.currentTarget.closest('[role=button]') as HTMLElement);
            }}
            className="flex size-11 items-center justify-center text-fg-muted hover:text-fg"
          >
            <Ellipsis className="size-5" aria-hidden />
          </button>
        )}
      </span>
    </div>
  );
}
