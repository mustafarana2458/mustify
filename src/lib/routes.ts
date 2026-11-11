/** Maps a Spotify URI to an in-app route. Returns null for unsupported types. */
export function routeForUri(uri: string): string | null {
  const parts = uri.split(':');
  // spotify:user:<id>:collection  or  spotify:collection:tracks  → Liked Songs
  if (parts.includes('collection')) return '/collection/tracks';
  const [, type, id] = parts;
  if (!id) return null;
  if (type === 'playlist' || type === 'album' || type === 'artist' || type === 'show' || type === 'episode') {
    return `/${type}/${id}`;
  }
  if (type === 'track') return null; // tracks link via their album
  return null;
}
