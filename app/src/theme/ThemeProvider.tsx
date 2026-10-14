import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { deriveTokens, prefersDark, SCHEMES, type Mode, type SchemeId, type Seeds, type Tokens } from './schemes';

export type Motion = 'system' | 'reduce' | 'full';

export type Appearance = {
  scheme: SchemeId;
  custom: Seeds;
  mode: Mode;
  motion: Motion;
  leaves: boolean;
};

const DEFAULTS: Appearance = {
  scheme: 'apollo',
  custom: { accent: '#3fa37c', ground: '#122a2a' },
  mode: 'dark',
  motion: 'system',
  leaves: true,
};

const KEY = 'fieldnote:appearance';

function load(): Appearance {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

type Ctx = {
  appearance: Appearance;
  update: (patch: Partial<Appearance>) => void;
  tokens: Tokens;
  dark: boolean;
  seeds: Seeds;
  reduceMotion: boolean;
};

const ThemeContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState(load);
  const [systemDark, setSystemDark] = useState(prefersDark);
  const [systemReduce, setSystemReduce] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const dark = matchMedia('(prefers-color-scheme: dark)');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const onDark = () => setSystemDark(dark.matches);
    const onReduce = () => setSystemReduce(reduce.matches);
    dark.addEventListener('change', onDark);
    reduce.addEventListener('change', onReduce);
    return () => {
      dark.removeEventListener('change', onDark);
      reduce.removeEventListener('change', onReduce);
    };
  }, []);

  const dark = appearance.mode === 'system' ? systemDark : appearance.mode === 'dark';
  const seeds = appearance.scheme === 'custom' ? appearance.custom : SCHEMES[appearance.scheme].seeds;
  const tokens = useMemo(() => deriveTokens(seeds, dark), [seeds.accent, seeds.ground, dark]);
  const reduceMotion = appearance.motion === 'reduce' || (appearance.motion === 'system' && systemReduce);

  useEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(tokens)) root.style.setProperty(`--${k}`, v);
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.motion = reduceMotion ? 'reduce' : 'full';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tokens.bg);
  }, [tokens, dark, reduceMotion]);

  const value = useMemo<Ctx>(
    () => ({
      appearance,
      dark,
      tokens,
      seeds,
      reduceMotion,
      update: (patch) =>
        setAppearance((prev) => {
          const next = { ...prev, ...patch };
          try {
            localStorage.setItem(KEY, JSON.stringify(next));
          } catch {
            /* private mode: keep it for this session only */
          }
          return next;
        }),
    }),
    [appearance, dark, tokens, seeds, reduceMotion],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme outside ThemeProvider');
  return ctx;
}
