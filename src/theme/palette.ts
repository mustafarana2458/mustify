import {
  composite,
  contrast,
  ensureContrast,
  hexToHsl,
  hslToHex,
  luminance,
  mix,
  readableOn,
  withAlpha,
} from '../lib/color';

/*
 * Theme palette generator. Every surface colour is computed from:
 *   - the theme's neutral colour for that surface (what you see at 0% tint)
 *   - an accent-hued colour with the theme's lightness for that surface (100% tint)
 *   - the Background tint amount t (0–1), which blends between the two.
 * Lightness is planned per theme, so the panels keep their contrast with the page
 * background at any tint. Text colours are then checked against the worst surface they
 * sit on and nudged until they meet WCAG AA (4.5:1 text, 3:1 icons/non-text).
 */

export type ThemeMode = 'dark' | 'darker' | 'light' | 'rose-dark' | 'blossom-light';

type SurfaceToken =
  | 'app'
  | 'surface'
  | 'surfaceHover'
  | 'surfacePress'
  | 'elevated'
  | 'elevatedHover'
  | 'elevatedPress'
  | 'divider';

interface ThemeDef {
  label: string;
  hint: string;
  kind: 'dark' | 'light';
  /** Surface colours at 0% tint. */
  neutral: Record<SurfaceToken, string>;
  /** HSL lightness (%) of each surface at 100% tint. */
  tintedLightness: Record<SurfaceToken, number>;
  /** Saturation (%) at 100% tint for a strongly saturated accent. */
  saturation: number;
  /** Outline the panels (needed when panels and page share the same lightness). */
  panelBorder?: boolean;
  /** Home header gradient always uses the accent. */
  accentHeader?: boolean;
  /** Background tint applied when you pick this theme. */
  presetTint?: number;
}

export const THEMES: Record<ThemeMode, ThemeDef> = {
  dark: {
    label: 'Dark',
    hint: 'Charcoal panels on black',
    kind: 'dark',
    neutral: {
      app: '#000000', surface: '#121212', surfaceHover: '#1F1F1F', surfacePress: '#000000',
      elevated: '#1F1F1F', elevatedHover: '#2A2A2A', elevatedPress: '#191919', divider: '#292929',
    },
    // Page lifts a little when tinted (pure black cannot carry a hue).
    tintedLightness: {
      app: 4, surface: 9, surfaceHover: 13.5, surfacePress: 5,
      elevated: 13, elevatedHover: 17, elevatedPress: 11, divider: 18,
    },
    saturation: 30,
  },
  darker: {
    label: 'Darker',
    hint: 'Pure black',
    kind: 'dark',
    neutral: {
      app: '#000000', surface: '#000000', surfaceHover: '#121212', surfacePress: '#000000',
      elevated: '#121212', elevatedHover: '#1F1F1F', elevatedPress: '#0A0A0A', divider: '#1F1F1F',
    },
    tintedLightness: {
      app: 2, surface: 4, surfaceHover: 9, surfacePress: 3,
      elevated: 8, elevatedHover: 12, elevatedPress: 6, divider: 13,
    },
    saturation: 35,
    panelBorder: true,
  },
  light: {
    label: 'Light',
    hint: 'White panels on light grey',
    kind: 'light',
    neutral: {
      app: '#E8E8EB', surface: '#FFFFFF', surfaceHover: '#F2F2F2', surfacePress: '#E5E5E5',
      elevated: '#F4F4F5', elevatedHover: '#E9E9EB', elevatedPress: '#DEDEE1', divider: '#DCDCDC',
    },
    tintedLightness: {
      app: 90, surface: 98, surfaceHover: 94, surfacePress: 90,
      elevated: 95, elevatedHover: 91.5, elevatedPress: 88, divider: 84,
    },
    saturation: 70,
  },
  'rose-dark': {
    label: 'Rose Dark',
    hint: 'Deep accent-tinted darks',
    kind: 'dark',
    neutral: {
      app: '#141414', surface: '#1E1E1E', surfaceHover: '#272727', surfacePress: '#171717',
      elevated: '#252525', elevatedHover: '#2E2E2E', elevatedPress: '#1F1F1F', divider: '#333333',
    },
    // With Baby Pink: page ≈ #1A0E12, panels ≈ #26151B, cards ≈ #2F1A21.
    tintedLightness: {
      app: 7.8, surface: 11.6, surfaceHover: 15.5, surfacePress: 9.5,
      elevated: 14.3, elevatedHover: 18.5, elevatedPress: 12.5, divider: 21,
    },
    saturation: 32,
    accentHeader: true,
    presetTint: 100,
  },
  'blossom-light': {
    label: 'Blossom Light',
    hint: 'Soft accent-tinted lights',
    kind: 'light',
    neutral: {
      app: '#F7F7F7', surface: '#F2F2F2', surfaceHover: '#EBEBEB', surfacePress: '#E3E3E3',
      elevated: '#EBEBEB', elevatedHover: '#E3E3E3', elevatedPress: '#DBDBDB', divider: '#D6D6D6',
    },
    // With Baby Pink: page ≈ #FFF0F4, panels ≈ #FFE5EC, cards ≈ #FFD6E2.
    tintedLightness: {
      app: 97, surface: 95, surfaceHover: 92, surfacePress: 89,
      elevated: 92, elevatedHover: 89, elevatedPress: 86, divider: 84,
    },
    saturation: 100,
    accentHeader: true,
    presetTint: 100,
  },
};

export const THEME_ORDER: ThemeMode[] = ['dark', 'darker', 'light', 'rose-dark', 'blossom-light'];

export interface PaletteInput {
  accent: string;
  theme: ThemeMode;
  /** 0–100 */
  bgTint: number;
  tintBackgrounds: boolean;
}

export interface Palette {
  kind: 'dark' | 'light';
  vars: Record<string, string>;
  /** Reported on the Appearance page. */
  report: { text: number; secondary: number; icons: number; accentText: number; panelVsPage: number; panelBorder: boolean };
}

/** Saturation actually used: scaled down for greyish accents so they don't produce odd hues. */
function effectiveSaturation(accent: string, themeSaturation: number): { hue: number; sat: number } {
  const [hue, s] = hexToHsl(accent);
  return { hue, sat: themeSaturation * Math.min(1, s / 70) };
}

export function generatePalette({ accent, theme, bgTint, tintBackgrounds }: PaletteInput): Palette {
  const def = THEMES[theme];
  const t = Math.max(0, Math.min(100, bgTint)) / 100;
  const { hue, sat } = effectiveSaturation(accent, def.saturation);
  const dark = def.kind === 'dark';

  const s = {} as Record<SurfaceToken, string>;
  for (const key of Object.keys(def.neutral) as SurfaceToken[]) {
    s[key] = mix(def.neutral[key], hslToHex(hue, sat, def.tintedLightness[key]), t);
  }

  // Hover/selected highlight overlays (bg-tint*): neutral, or a soft accent when the
  // "Tint backgrounds with accent" option is on.
  const overlay = tintBackgrounds ? accent : dark ? '#FFFFFF' : '#000000';
  const tintAlpha = tintBackgrounds ? [0.14, 0.2, 0.28] : dark ? [0.1, 0.14, 0.21] : [0.05, 0.08, 0.12];

  // Surfaces that carry text, including a hovered row (worst case for secondary text).
  const textSurfaces = [s.app, s.surface, s.surfaceHover, s.elevated, s.elevatedHover, composite(s.surface, overlay, tintAlpha[1])];
  const worst = textSurfaces.reduce((w, c) => (dark ? (luminance(c) > luminance(w) ? c : w) : luminance(c) < luminance(w) ? c : w));

  // Text colours lean slightly toward the accent hue as the tint grows, then are checked.
  const fg = ensureContrast(dark ? '#FFFFFF' : mix('#121212', hslToHex(hue, sat * 0.5, 10), t), worst, 4.5);
  const fgMuted = ensureContrast(
    mix(dark ? '#B3B3B3' : '#5C5C5C', hslToHex(hue, sat * 0.6, dark ? 75 : 36), t * 0.6),
    worst,
    4.5,
  );
  const iconMuted = ensureContrast(
    mix(dark ? '#7C7C7C' : '#8A8A8A', hslToHex(hue, sat * 0.5, dark ? 52 : 50), t * 0.5),
    worst,
    3,
  );
  const status = dark
    ? { danger: '#F3727F', warning: '#FFA42B', info: '#539DF5' }
    : { danger: '#C62A3A', warning: '#A35F00', info: '#1A6FD1' };

  // Home header gradient.
  const headerStrength = def.accentHeader || tintBackgrounds ? 1 : t;
  const header = dark
    ? withAlpha(mix('#FFFFFF', accent, headerStrength), 0.12 + 0.18 * headerStrength)
    : withAlpha(mix('#000000', accent, headerStrength), 0.06 + 0.22 * headerStrength);

  // Panels must stay distinguishable from the page: if their contrast is too low, outline them.
  const panelVsPage = contrast(s.app, s.surface);
  const needsBorder = def.panelBorder || panelVsPage < 1.1;

  // Accent derivatives. accent-ink is used for TEXT (e.g. the playing track's title) as well as
  // icons, so it must meet WCAG AA for normal text (4.5:1), not just the 3:1 for UI graphics.
  const ink = ensureContrast(accent, worst, 4.5);

  return {
    kind: def.kind,
    vars: {
      '--color-app': s.app,
      '--color-surface': s.surface,
      '--color-surface-hover': s.surfaceHover,
      '--color-surface-press': s.surfacePress,
      '--color-elevated': s.elevated,
      '--color-elevated-hover': s.elevatedHover,
      '--color-elevated-press': s.elevatedPress,
      '--color-divider': s.divider,
      '--color-tint': withAlpha(overlay, tintAlpha[0]),
      '--color-tint-hover': withAlpha(overlay, tintAlpha[1]),
      '--color-tint-press': withAlpha(overlay, tintAlpha[2]),
      '--color-fg': fg,
      '--color-fg-muted': fgMuted,
      '--color-icon-muted': iconMuted,
      '--color-danger': ensureContrast(status.danger, worst, 4.5),
      '--color-warning': ensureContrast(status.warning, worst, 4.5),
      '--color-info': ensureContrast(status.info, worst, 4.5),
      '--color-header': header,
      '--color-panel-border': needsBorder ? (dark ? mix(s.divider, '#FFFFFF', 0.04) : s.divider) : 'transparent',
      '--color-accent': accent,
      '--color-accent-hover': mix(accent, '#FFFFFF', 0.15),
      '--color-accent-press': mix(accent, '#000000', 0.15),
      '--color-on-accent': readableOn(accent),
      '--color-accent-ink': ink,
      /** Content drawn on an accent-ink fill (the filled ✓ of liked/saved buttons). */
      '--color-on-accent-ink': readableOn(ink),
    },
    report: {
      text: contrast(fg, worst),
      secondary: contrast(fgMuted, worst),
      icons: contrast(iconMuted, worst),
      accentText: contrast(ink, worst),
      panelVsPage,
      panelBorder: needsBorder,
    },
  };
}
