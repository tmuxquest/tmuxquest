const KEY = 'tmuxquest:session';

export interface SessionSnapshot {
  v: 2;
  missionId: string;
}

let memory: SessionSnapshot | null = null;

export function isValid(raw: unknown): raw is SessionSnapshot {
  if (!raw || typeof raw !== 'object') return false;
  const s = raw as Record<string, unknown>;
  if (s['v'] !== 2) return false;
  if (typeof s['missionId'] !== 'string' || !s['missionId']) return false;
  return true;
}

export function loadSession(): SessionSnapshot | null {
  let raw: string | null;
  try { raw = localStorage.getItem(KEY); }
  catch { return memory ? structuredClone(memory) : null; }
  if (raw == null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValid(parsed)) {
      clearSession();
      return null;
    }
    memory = structuredClone(parsed);
    return structuredClone(parsed);
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(s: SessionSnapshot): void {
  memory = structuredClone(s);
  try { localStorage.setItem(KEY, JSON.stringify(s)); }
  catch { }
}

export function clearSession(): void {
  memory = null;
  try { localStorage.removeItem(KEY); }
  catch { }
}
