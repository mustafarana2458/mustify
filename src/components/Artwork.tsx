import { Heart, Music } from 'lucide-react';
import { useState } from 'react';
import type { SpotifyImage } from '../api/types';
import { pickImage } from '../lib/images';

interface Props {
  images?: SpotifyImage[] | null;
  /** Rendered width in CSS px, used to choose an image size. */
  px: number;
  alt?: string;
  round?: boolean;
  liked?: boolean;
  className?: string;
}

/** Cover image with lazy loading, a fade-in, and my own fallbacks (Liked Songs / no art). */
export function Artwork({ images, px, alt = '', round, liked, className = '' }: Props) {
  const [loaded, setLoaded] = useState(false);
  const src = liked ? undefined : pickImage(images, px);
  // Non-round art takes its radius from className, so only one radius class ever applies.
  const shape = round ? '!rounded-full' : '';

  if (liked) {
    return (
      <span className={`flex items-center justify-center bg-gradient-to-br from-accent to-indigo-700 ${shape} ${className}`}>
        <Heart className="size-[40%] fill-white text-white" aria-hidden />
      </span>
    );
  }
  if (!src) {
    return (
      <span className={`flex items-center justify-center bg-elevated-hover text-fg-muted ${shape} ${className}`}>
        <Music className="size-[40%]" aria-hidden />
      </span>
    );
  }
  return (
    <span className={`block overflow-hidden bg-elevated ${shape} ${className}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={`size-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </span>
  );
}
