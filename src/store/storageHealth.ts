const PROBE_KEY = '__tmuxquest_probe__';

let _cached: boolean | undefined;

export function storageAvailable(): boolean {
  if (_cached !== undefined) return _cached;
  try {
    localStorage.setItem(PROBE_KEY, '1');
    const ok = localStorage.getItem(PROBE_KEY) === '1';
    localStorage.removeItem(PROBE_KEY);
    _cached = ok;
  } catch {
    _cached = false;
  }
  return _cached;
}

export function _resetStorageAvailableCache(): void {
  _cached = undefined;
}
