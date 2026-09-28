import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Translation } from './esv';

export interface Prefs {
  theme: 'system' | 'light' | 'dark';
  fontScale: number;
  translation: Translation;
  showGreek: boolean;
  lastRead: { book: string; chapter: number };
}

const DEFAULTS: Prefs = {
  theme: 'system',
  fontScale: 1,
  translation: 'ESV',
  showGreek: false,
  lastRead: { book: 'jhn', chapter: 1 },
};

const KEY = 'deep-study-prefs';

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

const Ctx = createContext<[Prefs, (p: Partial<Prefs>) => void]>([DEFAULTS, () => {}]);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(load);
  const update = (p: Partial<Prefs>) =>
    setPrefs((prev) => {
      const next = { ...prev, ...p };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: keep in memory */
      }
      return next;
    });

  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = prefs.theme;
    root.style.setProperty('--font-scale', String(prefs.fontScale));
  }, [prefs.theme, prefs.fontScale]);

  return <Ctx.Provider value={[prefs, update]}>{children}</Ctx.Provider>;
}

export const usePrefs = () => useContext(Ctx);
