import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Per-device preferences (privacy mode, theme cache). Stored in localStorage
 * only as a convenience; every read/write is guarded because storage can be
 * unavailable (private windows, blocked site data).
 */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Privacy mode
// ---------------------------------------------------------------------------

interface PrivacyCtx {
  hidden: boolean;
  toggle: () => void;
  setDefault: (hidden: boolean) => void;
}
const Privacy = createContext<PrivacyCtx>({ hidden: false, toggle: () => {}, setDefault: () => {} });

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const stored = read('wmm.privacy');
  const [hidden, setHidden] = useState(stored === '1');
  const [touched, setTouched] = useState(stored !== null);

  useEffect(() => {
    document.documentElement.classList.toggle('privacy', hidden);
  }, [hidden]);

  const toggle = useCallback(() => {
    setHidden((h) => {
      write('wmm.privacy', h ? '0' : '1');
      return !h;
    });
    setTouched(true);
  }, []);

  /** Applies the server-side default unless this device already chose. */
  const setDefault = useCallback(
    (value: boolean) => {
      if (!touched) setHidden(value);
    },
    [touched],
  );

  // Keyboard shortcut: P (ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'p' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  const value = useMemo(() => ({ hidden, toggle, setDefault }), [hidden, toggle, setDefault]);
  return <Privacy.Provider value={value}>{children}</Privacy.Provider>;
}

export const usePrivacy = () => useContext(Privacy);

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export type ThemePref = 'system' | 'light' | 'dark';

export function applyTheme(pref: ThemePref) {
  write('wmm.theme', pref);
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function initialTheme(): ThemePref {
  const v = read('wmm.theme');
  return v === 'light' || v === 'dark' ? v : 'system';
}

export function useSystemThemeListener(pref: ThemePref) {
  useEffect(() => {
    applyTheme(pref);
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);
}
