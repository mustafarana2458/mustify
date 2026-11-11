import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { markSvg } from '../brand/mark';
import { normalizeHex } from '../lib/color';
import { generatePalette, THEMES, type ThemeMode } from '../theme/palette';

export type { ThemeMode } from '../theme/palette';

export const DEFAULT_ACCENT = '#1ED7A5';

export const ACCENT_PRESETS: { name: string; hex: string }[] = [
  { name: 'Teal', hex: '#1ED7A5' },
  { name: 'Baby Pink', hex: '#F8A5C2' },
  { name: 'Lavender', hex: '#B39DFF' },
  { name: 'Sky Blue', hex: '#6EC6FF' },
  { name: 'Peach', hex: '#FFB38A' },
  { name: 'Mint', hex: '#9BE7C4' },
  { name: 'Red', hex: '#FF5A6E' },
  { name: 'Gold', hex: '#F5C451' },
];

interface AppearanceState {
  accent: string;
  theme: ThemeMode;
  /** "Tint backgrounds with accent": header gradient + hover/active highlights. */
  tintBackgrounds: boolean;
  /** Background tint 0–100: how much of the accent is mixed into every surface. */
  bgTint: number;
  setAccent: (hex: string) => void;
  setTheme: (theme: ThemeMode) => void;
  setTintBackgrounds: (on: boolean) => void;
  setBgTint: (value: number) => void;
  reset: () => void;
}

const DEFAULTS = { accent: DEFAULT_ACCENT, theme: 'dark' as ThemeMode, tintBackgrounds: false, bgTint: 0 };

export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setAccent: (hex) => {
        const n = normalizeHex(hex);
        if (n) set({ accent: n });
      },
      // Rose Dark / Blossom Light are built on the tint: picking one sets its preset strength.
      setTheme: (theme) => set((s) => ({ theme, bgTint: THEMES[theme].presetTint ?? s.bgTint })),
      setTintBackgrounds: (tintBackgrounds) => set({ tintBackgrounds }),
      setBgTint: (value) => set({ bgTint: Math.round(Math.max(0, Math.min(100, value))) }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'appearance',
      // Guard against hand-edited / corrupted values in localStorage.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppearanceState>;
        return {
          ...current,
          accent: (p.accent && normalizeHex(p.accent)) || current.accent,
          theme: p.theme && p.theme in THEMES ? p.theme : current.theme,
          tintBackgrounds: typeof p.tintBackgrounds === 'boolean' ? p.tintBackgrounds : current.tintBackgrounds,
          bgTint: typeof p.bgTint === 'number' && p.bgTint >= 0 && p.bgTint <= 100 ? p.bgTint : current.bgTint,
        };
      },
    },
  ),
);

type Input = Pick<AppearanceState, 'accent' | 'theme' | 'tintBackgrounds' | 'bgTint'>;

/** Writes the generated palette to <html> as CSS variables (all utilities read these). */
export function applyAppearance(input: Input) {
  const root = document.documentElement;
  const palette = generatePalette(input);
  for (const [name, value] of Object.entries(palette.vars)) root.style.setProperty(name, value);
  root.dataset.theme = input.theme;
  root.style.colorScheme = palette.kind;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.vars['--color-app']);
  // The browser-tab icon follows your accent too.
  const favicon = markSvg({ bg: palette.vars['--color-accent'], fg: palette.vars['--color-on-accent'] });
  document
    .querySelector('link[rel="icon"]')
    ?.setAttribute('href', `data:image/svg+xml,${encodeURIComponent(favicon)}`);
}

/** Apply now (before first render, so there is no flash) and on every change. */
export function initAppearance() {
  applyAppearance(useAppearance.getState());
  useAppearance.subscribe((s) => applyAppearance(s));
}
