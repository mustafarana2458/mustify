import { useToasts } from '../store/toasts';

/** Transient messages above the player bar. Uses the spec's "announcement" blue (§2.1). */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div
      role="status"
      aria-live="polite"
      // On mobile, sit above the mini player and tab bar.
      className="pointer-events-none absolute bottom-24 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2 max-md:bottom-[calc(8.5rem+env(safe-area-inset-bottom))]"
    >
      {toasts.map((t) => (
        <div key={t.id} className="max-w-[min(480px,90vw)] rounded-lg bg-[#0d72ea] px-4 py-3 text-sm text-white shadow-overlay">
          {t.message}
        </div>
      ))}
    </div>
  );
}
