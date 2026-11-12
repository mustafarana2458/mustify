import { ChevronLeft, ChevronRight, House } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { APP_NAME } from '../brand/info';
import { AccountMenu } from '../components/AccountMenu';
import { IconButton } from '../components/IconButton';
import { LogoMark } from '../components/Logo';
import { OfflineBadge } from '../components/OfflineGate';
import { SearchInput } from '../components/SearchInput';

/** Global nav (UI-SPEC §1.2, desktop only): logo, history arrows, Home, search, account. 48px tall. */
export function TopBar() {
  const navigate = useNavigate();

  return (
    <header className="flex h-12 items-center justify-between gap-4 px-2" style={{ gridArea: 'nav' }}>
      <div className="flex shrink-0 items-center gap-2">
        <Link to="/" aria-label={`${APP_NAME} home`} className="mx-2 rounded-[9px]">
          <LogoMark size={30} />
        </Link>
        <OfflineBadge />
        <IconButton label="Go back" size="md" filled onClick={() => navigate(-1)}>
          <ChevronLeft className="size-5" aria-hidden />
        </IconButton>
        <IconButton label="Go forward" size="md" filled onClick={() => navigate(1)}>
          <ChevronRight className="size-5" aria-hidden />
        </IconButton>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        <IconButton label="Home" size="lg" filled onClick={() => navigate('/')}>
          <House className="size-6" aria-hidden />
        </IconButton>
        <div className="w-full max-w-[480px]">
          <SearchInput showShortcut />
        </div>
      </div>

      <div className="flex shrink-0 items-center">
        <AccountMenu />
      </div>
    </header>
  );
}
