import { create } from 'zustand';

/**
 * Colour of the backdrop behind the iPhone status bar once a page is scrolled (mobile).
 * null = the page background. Entity pages set their header colour so the backdrop matches
 * their sticky title bar.
 */
export const useStatusBarColor = create<{ color: string | null }>()(() => ({ color: null }));
