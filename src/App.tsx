import { Navigate, Route, Routes } from 'react-router';
import { selectIsLoggedIn, useAuth } from './auth/authStore';
import { AppShell } from './layout/AppShell';
import { AboutPage } from './pages/AboutPage';
import { AlbumPage } from './pages/AlbumPage';
import { AppearancePage } from './pages/AppearancePage';
import { ArtistPage } from './pages/ArtistPage';
import { CallbackPage } from './pages/CallbackPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { HomePage } from './pages/HomePage';
import { LibraryPage } from './pages/LibraryPage';
import { LikedSongsPage } from './pages/LikedSongsPage';
import { LoginPage } from './pages/LoginPage';
import { OfflinePage } from './pages/OfflinePage';
import { PlaylistPage } from './pages/PlaylistPage';
import { ProfilePage } from './pages/ProfilePage';
import { SearchPage } from './pages/SearchPage';

export function App() {
  const loggedIn = useAuth(selectIsLoggedIn);

  return (
    <Routes>
      <Route path="/callback" element={<CallbackPage />} />
      {loggedIn ? (
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="playlist/:id" element={<PlaylistPage />} />
          <Route path="album/:id" element={<AlbumPage />} />
          <Route path="artist/:id" element={<ArtistPage />} />
          <Route path="collection/tracks" element={<LikedSongsPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="offline" element={<OfflinePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings/appearance" element={<AppearancePage />} />
          <Route path="about" element={<AboutPage />} />
          {/* Podcast show/episode pages are not built yet. */}
          <Route path="show/:id" element={<ComingSoonPage />} />
          <Route path="episode/:id" element={<ComingSoonPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<LoginPage />} />
      )}
    </Routes>
  );
}
