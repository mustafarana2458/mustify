import { CodeXml, ExternalLink, Globe } from 'lucide-react';
import { APP_NAME, APP_TAGLINE, AUTHOR } from '../brand/info';
import { Wordmark } from '../components/Logo';

const initials = AUTHOR.name
  .split(/\s+/)
  .map((p) => p[0])
  .join('')
  .slice(0, 2)
  .toUpperCase();

const display = (url: string) => url.replace(/^https?:\/\//, '');

function ExtLink({ href, icon: Icon, label }: { href: string; icon: typeof Globe; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-tint"
    >
      <Icon className="size-5 shrink-0 text-fg-muted" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{label}</span>
        <span className="block truncate text-fg-muted">{display(href)}</span>
      </span>
      <ExternalLink className="size-4 shrink-0 text-fg-muted" aria-label="(opens in a new tab)" />
    </a>
  );
}

/** About (account menu → About): the app and its author. */
export function AboutPage() {
  return (
    <div className="mx-auto max-w-xl px-6 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-16">
      <Wordmark size={40} />
      <p className="mt-3 text-fg-muted">{APP_TAGLINE}</p>
      <p className="mt-1 text-xs text-fg-muted">Version {__APP_VERSION__}</p>

      <section className="mt-10 rounded-lg bg-elevated p-5">
        <h2 className="mb-4 text-xs font-bold tracking-wide text-fg-muted uppercase">Designed &amp; built by</h2>
        <div className="mb-4 flex items-center gap-4">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-extrabold text-on-accent"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="text-xl font-bold">{AUTHOR.name}</p>
            <p className="text-sm text-fg-muted">{AUTHOR.bio}</p>
          </div>
        </div>
        <div className="-mx-3">
          <ExtLink href={AUTHOR.github} icon={CodeXml} label="GitHub" />
          <ExtLink href={AUTHOR.portfolio} icon={Globe} label="Portfolio" />
        </div>
      </section>

      <p className="mt-8 text-xs leading-relaxed text-fg-muted">
        Powered by the Spotify Web API and Web Playback SDK. {APP_NAME} is an independent personal project and isn't
        affiliated with or endorsed by Spotify.
      </p>
    </div>
  );
}
