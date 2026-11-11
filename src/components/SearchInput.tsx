import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

export const GLOBAL_SEARCH_ID = 'global-search';
const SEARCH_DEBOUNCE_MS = 300; // chosen

/**
 * Search box ↔ URL (/search?q=…). Typing updates the URL after a pause (debounce), so the
 * Search page fetches once per pause, not per keystroke. Back/forward updates the box.
 * Used in the desktop top bar and at the top of the mobile Search page.
 */
export function SearchInput({ autoFocus = false, showShortcut = false }: { autoFocus?: boolean; showShortcut?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const onSearchPage = location.pathname === '/search';
  const urlQuery = onSearchPage ? (params.get('q') ?? '') : '';
  const [value, setValue] = useState(urlQuery);

  const goSearch = (text: string, replace: boolean) => {
    const q = text.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search', { replace });
  };

  useEffect(() => {
    // Don't overwrite what the user is typing; sync only when the box isn't focused.
    if (document.activeElement?.id !== GLOBAL_SEARCH_ID) setValue(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (value.trim() === urlQuery.trim()) return;
    if (!onSearchPage && !value.trim()) return;
    const t = window.setTimeout(() => goSearch(value, onSearchPage), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
    // Re-run only when the text changes.
  }, [value]);

  return (
    <form
      role="search"
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        goSearch(value, onSearchPage);
        (document.activeElement as HTMLElement | null)?.blur(); // closes the mobile keyboard
      }}
    >
      <label className="flex h-12 items-center gap-3 rounded-full bg-elevated px-4 text-fg-muted shadow-[inset_0_0_0_1px_transparent] transition-[background-color,box-shadow] duration-150 focus-within:shadow-[inset_0_0_0_2px_var(--color-accent-ink)] hover:bg-elevated-hover">
        <Search className="size-5 shrink-0" aria-hidden />
        <input
          id={GLOBAL_SEARCH_ID}
          name="q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => !onSearchPage && navigate('/search')}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setValue('');
              e.currentTarget.blur();
            }
          }}
          placeholder="Search songs, artists, podcasts"
          aria-label="Search"
          // 16px text stops iOS Safari from zooming in when the field is focused.
          className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button type="button" aria-label="Clear search" onClick={() => setValue('')} className="-mr-2 flex size-9 items-center justify-center rounded-full hover:text-fg">
            <X className="size-5" aria-hidden />
          </button>
        )}
        {showShortcut && !value && <kbd className="hidden rounded-xs border border-fg/20 px-1.5 text-xs lg:inline">Ctrl K</kbd>}
      </label>
    </form>
  );
}
