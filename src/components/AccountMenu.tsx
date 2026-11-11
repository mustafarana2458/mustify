import { Info, LogOut, Palette, User } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useApi } from '../api/hooks';
import type { UserProfile } from '../api/types';
import { useAuth } from '../auth/authStore';
import { Menu } from './Menu';

/** Avatar button with Profile / Appearance / About / Log out (top bar; mobile page headers). */
export function AccountMenu({ size = 48, align = 'end' }: { size?: number; align?: 'start' | 'end' }) {
  const navigate = useNavigate();
  const logout = useAuth((s) => s.logout);
  const { data: me } = useApi<UserProfile>('/me');
  const avatar = me?.images?.[0]?.url;

  return (
    <Menu
      align={align}
      items={[
        { label: 'Profile', icon: User, onSelect: () => navigate('/profile') },
        { label: 'Appearance', icon: Palette, onSelect: () => navigate('/settings/appearance') },
        { label: 'About', icon: Info, onSelect: () => navigate('/about') },
        { label: 'Log out', icon: LogOut, onSelect: logout, separatorBefore: true },
      ]}
      trigger={(props) => (
        <button
          type="button"
          title={me?.display_name ?? 'Account'}
          aria-label="Account menu"
          className="flex shrink-0 items-center justify-center rounded-full bg-elevated transition-transform duration-150 hover:scale-[1.04] hover:duration-[50ms]"
          style={{ width: size, height: size }}
          {...props}
        >
          {avatar ? (
            <img src={avatar} alt="" className="rounded-full object-cover" style={{ width: size * 0.66, height: size * 0.66 }} />
          ) : (
            <User className="size-5 text-fg-muted" aria-hidden />
          )}
        </button>
      )}
    />
  );
}
