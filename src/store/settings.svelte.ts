import { DEFAULT_PREFIX, isValidPrefixToken } from './prefixSpec';

export type ThemePref = 'auto' | 'dark' | 'light';
export type ThemeName = 'dark' | 'light';

export const THEME_PREFS: ThemePref[] = ['auto', 'dark', 'light'];

const KEY = 'tmuxquest:settings';

interface Persisted { theme: ThemePref; prefix: string; }
const DEFAULTS: Persisted = { theme: 'auto', prefix: DEFAULT_PREFIX };

function isPref(v: unknown): v is ThemePref {
  return typeof v === 'string' && (THEME_PREFS as string[]).includes(v);
}

function migrateTheme(v: unknown): ThemePref {
  if (isPref(v)) return v;
  if (v === 'paper') return 'light';
  if (v === 'default' || v === 'phosphor' || v === 'amber') return 'dark';
  return DEFAULTS.theme;
}

function load(): Persisted {
  let raw: string | null;
  try { raw = localStorage.getItem(KEY); } catch { return { ...DEFAULTS }; }
  if (!raw) return { ...DEFAULTS };
  try {
    const p = JSON.parse(raw) as Partial<Persisted>;
    return {
      theme: migrateTheme(p?.theme),
      prefix: isValidPrefixToken(p?.prefix) ? p.prefix : DEFAULT_PREFIX,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function systemPrefersLight(): boolean {
  try { return window.matchMedia('(prefers-color-scheme: light)').matches; }
  catch { return false; }
}

export function resolveTheme(pref: ThemePref, light = systemPrefersLight()): ThemeName {
  if (pref === 'auto') return light ? 'light' : 'dark';
  return pref;
}

export function readPersistedTheme(): ThemePref {
  return load().theme;
}

export function readResolvedTheme(): ThemeName {
  return resolveTheme(load().theme);
}

export function readPersistedPrefix(): string {
  return load().prefix;
}

export function createSettings() {
  const init = load();
  let pref = $state<ThemePref>(init.theme);
  let systemLight = $state(systemPrefersLight());
  let pfx = $state<string>(init.prefix);

  try {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener?.('change', (e) => { systemLight = e.matches; });
  } catch { }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ theme: pref, prefix: pfx })); }
    catch { }
  }

  return {
    get theme() { return pref; },
    set theme(v: ThemePref) { pref = v; persist(); },
    get resolvedTheme(): ThemeName {
      return pref === 'auto' ? (systemLight ? 'light' : 'dark') : pref;
    },
    cycleTheme() {
      const i = THEME_PREFS.indexOf(pref);
      pref = THEME_PREFS[(i + 1) % THEME_PREFS.length]!;
      persist();
    },
    get prefix() { return pfx; },
    setPrefix(token: string) { if (!isValidPrefixToken(token)) return; pfx = token; persist(); },
  };
}
