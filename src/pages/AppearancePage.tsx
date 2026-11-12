import { Check, Pause, Shuffle } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { APP_NAME } from '../brand/info';
import { Button } from '../components/Button';
import { LogoMark } from '../components/Logo';
import { Chip } from '../components/Chip';
import { IconButton } from '../components/IconButton';
import { Slider } from '../components/Slider';
import { contrast, normalizeHex, readableOn } from '../lib/color';
import { ACCENT_PRESETS, useAppearance } from '../store/appearance';
import { generatePalette, THEME_ORDER, THEMES, type ThemeMode } from '../theme/palette';

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold">{title}</h2>
      {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Mini preview of a theme, generated from the current accent (so it follows accent changes). */
function ThemePreview({ mode, accent, bgTint, tintBackgrounds }: { mode: ThemeMode; accent: string; bgTint: number; tintBackgrounds: boolean }) {
  const v = useMemo(() => generatePalette({ accent, theme: mode, bgTint, tintBackgrounds }).vars, [accent, mode, bgTint, tintBackgrounds]);
  const outline = v['--color-panel-border'] !== 'transparent' ? `1px solid ${v['--color-panel-border']}` : undefined;
  return (
    <span className="flex h-20 gap-1 rounded-md p-1" style={{ backgroundColor: v['--color-app'] }} aria-hidden>
      <span className="w-1/3 rounded-sm" style={{ backgroundColor: v['--color-surface'], outline }} />
      <span
        className="flex flex-1 flex-col justify-between rounded-sm p-1.5"
        style={{ background: `linear-gradient(${v['--color-header']}, ${v['--color-surface']} 70%)`, backgroundColor: v['--color-surface'], outline }}
      >
        <span className="h-1.5 w-2/3 rounded-full" style={{ backgroundColor: v['--color-fg'] }} />
        <span className="flex items-end justify-between">
          <span className="h-5 w-8 rounded-xs" style={{ backgroundColor: v['--color-elevated'] }} />
          <span className="size-3 rounded-full" style={{ backgroundColor: accent }} />
        </span>
      </span>
    </span>
  );
}

const ratio = (n: number) => `${n.toFixed(1)}:1`;

/** Settings → Appearance. Every change applies instantly and is saved to localStorage. */
export function AppearancePage() {
  const { accent, theme, tintBackgrounds, bgTint, setAccent, setTheme, setTintBackgrounds, setBgTint, reset } = useAppearance();
  const palette = useMemo(() => generatePalette({ accent, theme, bgTint, tintBackgrounds }), [accent, theme, bgTint, tintBackgrounds]);
  const isPreset = ACCENT_PRESETS.some((p) => p.hex === accent);

  // Hex text field keeps its own (possibly invalid, mid-typing) value.
  const [hexText, setHexText] = useState(accent);
  useEffect(() => setHexText(accent), [accent]);
  const hexValid = normalizeHex(hexText) !== null;
  const hexId = useId();
  const tintId = useId();

  const [previewVolume, setPreviewVolume] = useState(0.6);
  const onAccent = palette.vars['--color-on-accent'];
  const r = palette.report;
  const passesAA = r.text >= 4.5 && r.secondary >= 4.5 && r.icons >= 3 && r.accentText >= 3;

  return (
    <div className="mx-auto max-w-3xl px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-16">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Appearance</h1>

      <Section title="Accent colour" description="Used for buttons, sliders, active filters, play buttons, focus rings and the logo, and for accent backgrounds below.">
        <div role="radiogroup" aria-label="Accent presets" className="flex flex-wrap gap-3">
          {ACCENT_PRESETS.map((p) => {
            const selected = p.hex === accent;
            return (
              <button
                key={p.hex}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${p.name} (${p.hex})`}
                title={p.name}
                onClick={() => setAccent(p.hex)}
                className={
                  'flex size-11 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 ' +
                  (selected ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface' : '')
                }
                style={{ backgroundColor: p.hex }}
              >
                {selected && <Check className="size-5" style={{ color: readableOn(p.hex) }} aria-hidden />}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label
            className={
              'relative flex size-11 cursor-pointer items-center justify-center overflow-hidden rounded-full ' +
              'bg-[conic-gradient(from_0deg,#ff5a6e,#f5c451,#9be7c4,#6ec6ff,#b39dff,#f8a5c2,#ff5a6e)] ' +
              (!isPreset ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface' : '')
            }
            title="Pick any colour"
          >
            <span className="sr-only">Custom colour picker</span>
            {/* Native picker: fires continuously while dragging → live preview everywhere. */}
            <input
              type="color"
              value={accent.toLowerCase()}
              onChange={(e) => setAccent(e.target.value)}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
            <span className="size-5 rounded-full border-2 border-white" style={{ backgroundColor: accent }} aria-hidden />
          </label>
          <label htmlFor={hexId} className="text-sm text-fg-muted">
            Hex
          </label>
          <input
            id={hexId}
            value={hexText}
            spellCheck={false}
            maxLength={7}
            aria-invalid={!hexValid}
            onChange={(e) => {
              const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
              setHexText(v.toUpperCase());
              if (/^#[0-9a-f]{6}$/i.test(v)) setAccent(v);
            }}
            onBlur={() => hexValid && setAccent(hexText)}
            className={
              'h-10 w-28 rounded-sm bg-elevated px-3 font-mono text-sm uppercase outline-none ' +
              'shadow-[inset_0_0_0_1px_var(--color-icon-muted)] focus:shadow-[inset_0_0_0_2px_var(--color-accent-ink)] ' +
              (hexValid ? '' : '!shadow-[inset_0_0_0_2px_var(--color-danger)]')
            }
          />
          {!hexValid && <span className="text-sm text-danger">Use #RRGGBB or #RGB</span>}
        </div>

        <p className="mt-3 text-xs text-fg-muted">
          Text on this accent is {onAccent === '#000000' ? 'black' : 'white'} (contrast {ratio(contrast(accent, onAccent))}).
          {palette.vars['--color-accent-ink'] !== accent &&
            ' Accent-coloured text and icons are adjusted slightly so they stay readable on these backgrounds.'}
        </p>

        <div className="mt-4 flex items-center gap-3 rounded-md bg-elevated p-3">
          {/* Preview of the app icon in the current accent (same mark the generated icons use). */}
          <LogoMark size={40} />
          <p className="text-xs text-fg-muted">
            The app icon uses this colour too. To update the home-screen icon on iPhone, remove {APP_NAME} from your home
            screen and add it again from Safari.
          </p>
        </div>
      </Section>

      <Section title="Theme" description="Rose Dark and Blossom Light build their colours from your accent, so switching accents re-colours them.">
        <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
          {THEME_ORDER.map((mode) => {
            const def = THEMES[mode];
            return (
              <label key={mode} className="cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value={mode}
                  checked={theme === mode}
                  onChange={() => setTheme(mode)}
                  className="peer sr-only"
                />
                <span
                  className={
                    'flex flex-col gap-3 rounded-lg p-3 shadow-[inset_0_0_0_1px_var(--color-divider)] transition-shadow ' +
                    'peer-checked:shadow-[inset_0_0_0_2px_var(--color-accent-ink)] ' +
                    'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-ink'
                  }
                >
                  <ThemePreview
                    mode={mode}
                    accent={accent}
                    // Show each theme the way it would look if picked now.
                    bgTint={theme === mode ? bgTint : (def.presetTint ?? bgTint)}
                    tintBackgrounds={tintBackgrounds}
                  />
                  <span>
                    <span className="block font-bold">{def.label}</span>
                    <span className="block text-xs text-fg-muted">{def.hint}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </Section>

      <Section
        title="Accent backgrounds"
        description="Mixes your accent into every surface: page, top bar, sidebar, panels, player bar, cards, menus and tiles."
      >
        <div className="flex items-center gap-4">
          <span className="w-28 shrink-0 text-sm font-bold">Background tint</span>
          <Slider
            label="Background tint"
            value={bgTint / 100}
            step={0.05}
            onChange={(v) => setBgTint(v * 100)}
            valueText={(v) => `${Math.round(v * 100)}%`}
            className="max-w-sm"
          />
          <span className="w-12 shrink-0 text-right text-sm tabular-nums text-fg-muted">{bgTint}%</span>
        </div>

        <p className={`mt-4 text-xs ${passesAA ? 'text-fg-muted' : 'text-warning'}`}>
          Contrast on the hardest surface: text {ratio(r.text)} · secondary text {ratio(r.secondary)} · icons {ratio(r.icons)} ·
          accent text {ratio(r.accentText)} {passesAA ? '(meets WCAG AA)' : '(below WCAG AA)'}
          {r.panelBorder && ' · panels are outlined to stay distinguishable'}
        </p>

        <div className="mt-6 flex items-start justify-between gap-6">
          <label htmlFor={tintId} className="cursor-pointer">
            <span className="block font-bold">Tint backgrounds with accent</span>
            <span className="block text-sm text-fg-muted">
              The Home header gradient and hover/active highlights use a soft version of your accent instead of neutral grey.
              Rose Dark and Blossom Light always tint the header.
            </span>
          </label>
          <button
            id={tintId}
            type="button"
            role="switch"
            aria-checked={tintBackgrounds}
            onClick={() => setTintBackgrounds(!tintBackgrounds)}
            className={
              'relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors duration-150 ' +
              (tintBackgrounds ? 'bg-accent' : 'bg-fg/30')
            }
          >
            <span
              className={
                'absolute top-0.5 left-0.5 size-5 rounded-full shadow-overlay transition-transform duration-150 ease-productive ' +
                (tintBackgrounds ? 'translate-x-5 bg-on-accent' : 'bg-white')
              }
            />
          </button>
        </div>
      </Section>

      <Section title="Live preview">
        <div className="space-y-5 rounded-lg bg-elevated p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Primary button</Button>
            <Button size="sm" variant="secondary">
              Secondary
            </Button>
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-on-accent shadow-play" aria-hidden>
              <Pause className="size-5 fill-current" />
            </span>
            <IconButton label="Shuffle (preview)" active>
              <Shuffle className="size-4" aria-hidden />
            </IconButton>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip selected>Active filter</Chip>
            <Chip>Inactive filter</Chip>
          </div>
          <div className="max-w-xs">
            <p className="mb-1 text-xs text-fg-muted">Hover or focus the slider to see the accent fill</p>
            <Slider label="Preview slider" value={previewVolume} onChange={setPreviewVolume} />
          </div>
          <p className="text-sm">
            Primary text, <span className="text-fg-muted">secondary text</span>, and{' '}
            <span className="font-bold text-accent-ink">accent text</span>.
          </p>
        </div>
      </Section>

      <Button variant="secondary" size="sm" onClick={reset}>
        Reset to defaults
      </Button>
    </div>
  );
}
