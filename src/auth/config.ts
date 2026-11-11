import { redirectUriFor } from './pkceCore';

export const CLIENT_ID: string = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';

/**
 * Follows wherever the app is served, e.g.
 *   dev:     http://127.0.0.1:5173/callback
 *   Netlify: https://<your-site>.netlify.app/callback
 * Each one must be listed under Redirect URIs in the Spotify dashboard.
 * VITE_SPOTIFY_REDIRECT_URI can still force a specific value.
 */
export const REDIRECT_URI: string =
  import.meta.env.VITE_SPOTIFY_REDIRECT_URI || redirectUriFor(window.location.origin);

export const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
export const TOKEN_URL = 'https://accounts.spotify.com/api/token';
export const API_BASE = 'https://api.spotify.com/v1';

/**
 * All scopes the later phases need are requested up front, so you consent once.
 * - profile:   user-read-private, user-read-email
 * - library:   user-library-read/modify, playlist-read-*, user-follow-read/modify
 * - home:      user-top-read, user-read-recently-played
 * - playback:  user-read-playback-state, user-modify-playback-state,
 *              user-read-currently-playing, streaming (Web Playback SDK),
 *              user-read-playback-position (podcast resume points)
 * - editing:   playlist-modify-public/private
 */
export const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-follow-read',
  'user-follow-modify',
  'user-top-read',
  'user-read-recently-played',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-playback-position',
  'streaming',
];

export const isConfigured = (): boolean =>
  CLIENT_ID.length > 0 && CLIENT_ID !== 'your_client_id_here';
