import { LibrarySidebar } from '../layout/LibrarySidebar';

/** "Your Library" as a full page (the mobile tab). Same data, filters and sorting as the sidebar. */
export function LibraryPage() {
  return (
    <div className="min-h-full">
      <LibrarySidebar collapsed={false} variant="page" />
    </div>
  );
}
