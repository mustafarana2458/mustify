import { Info } from 'lucide-react';

/**
 * Placeholder for features the spec marks ❌ (no official Web API equivalent),
 * e.g. artist bio, credits, lyrics. Shown instead of the real feature.
 */
export function NotAvailableCard({ title, className = '' }: { title: string; className?: string }) {
  return (
    <section className={`rounded-lg bg-elevated p-4 ${className}`}>
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
        <Info className="size-4 text-fg-muted" aria-hidden />
        {title}
      </h3>
      <p className="text-xs text-fg-muted">Not available through the official Spotify Web API.</p>
    </section>
  );
}
