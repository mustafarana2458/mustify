import { useLocation } from 'react-router';

/** Placeholder for routes that aren't built yet (podcast show/episode pages). */
export function ComingSoonPage() {
  const { pathname } = useLocation();
  return (
    <div className="p-6 pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <h1 className="mb-2 text-2xl font-bold">Not built yet</h1>
      <p className="text-sm text-fg-muted">
        <code className="rounded-xs bg-tint px-1">{pathname}</code>: podcast pages haven't been built yet. Use the play
        button on the card to listen.
      </p>
    </div>
  );
}
