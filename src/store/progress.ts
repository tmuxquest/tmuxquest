export interface MissionResult {
  cleared: true;
  bestTimeMs?: number;
  bestStars?: 1 | 2 | 3;
}
export interface Progress {
  results: Record<string, MissionResult>;
}

const KEY = 'tmuxquest:progress';
let memory: Progress = { results: {} };

const LEGACY_ID_MAP: Record<string, string | null> = {
  'm04-housekeeping':       'm03-housekeeping',
  'm05-the-split':          'm04-the-split',
  'm07-pane-dance':         'm05-pane-dance',
  'm08-focus-mode':         'm06-focus-mode',
  'm09-many-lives':         'm07-many-lives',
  'm10-session-hop':        'm08-session-hop',
  'm11-build-the-cockpit':  'm09-build-the-cockpit',
  'm12-boss-rescue':        'm10-boss-rescue',
  'm13-scroll-back':        'm11-scroll-back',
  'm14-find-it':            'm12-find-it',
  'm15-grab-the-error':     'm13-grab-the-error',
  'm20-character-copy':     'm14-character-copy',
  'm16-prompt-power':       'm15-prompt-power',
  'm17-clean-house':        'm16-clean-house',
  'm18-shuffle':            'm17-shuffle',
  'm19-drop-here':          'm18-drop-here',
  'm21-pick-session':       'm19-pick-session',
  'm25-shape-it':           'm20-shape-it',
  'm27-break-it-out':       'm21-break-it-out',
  'm30-default-source':     'm22-default-source',
  'm31-stack-the-buffers':  'm23-stack-the-buffers',
  'm33-type-it':            'm24-type-it',
  'm34-fresh-start':        'm25-fresh-start',
  'm35-wipe-the-noise':     'm26-wipe-the-noise',
  'm36-pick-a-buffer':      'm27-pick-a-buffer',
  'm37-rebind-the-prefix':  'm28-rebind-the-prefix',
  'm29-first-read':         null,
  'm30-two-logs':           null,
  'm31-two-boxes':          null,
  'm32-build-runbook':      null,
  'm33-repl-driver':        null,
  'm29-the-stream':         null,
  'm30-six-hosts':          null,
  'm31-find-the-session':   null,
  'm32-the-recovery':       null,
  'm33-peek-before-paste':  null,
  'm35-source-the-config':  'm37-source-the-config',
  'm37-set-options':        'm35-set-options',
};

function migrateMissionResult(raw: unknown): MissionResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const out: MissionResult = { cleared: true };
  if (typeof o['bestTimeMs'] === 'number' && o['bestTimeMs'] >= 0) out.bestTimeMs = o['bestTimeMs'];
  if (o['bestStars'] === 1 || o['bestStars'] === 2 || o['bestStars'] === 3) out.bestStars = o['bestStars'];
  return out;
}

function normalize(raw: unknown): Progress {
  if (!raw || typeof raw !== 'object') return { results: {} };
  const obj = raw as Record<string, unknown>;
  const r = obj['results'];
  if (!r || typeof r !== 'object') return { results: {} };
  const results: Record<string, MissionResult> = {};
  for (const id of Object.keys(r as Record<string, unknown>)) {
    const entry = (r as Record<string, unknown>)[id];
    const migrated = migrateMissionResult(entry);
    if (!migrated) continue;
    const mapped = LEGACY_ID_MAP[id];
    if (mapped === null) continue;
    const newId = mapped ?? id;
    results[newId] = migrated;
  }
  return { results };
}

export function loadProgress(): Progress {
  let raw: string | null;
  try { raw = localStorage.getItem(KEY); }
  catch { return structuredClone(memory); }
  if (!raw) return structuredClone(memory);
  try {
    const p = normalize(JSON.parse(raw));
    memory = p;
    return structuredClone(p);
  } catch {
    return { results: {} };
  }
}

export function saveProgress(p: Progress): void {
  memory = structuredClone(p);
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { }
}

export function recordResult(missionId: string, run?: { timeMs: number; stars: 1 | 2 | 3 }): void {
  const p = loadProgress();
  const prev = p.results[missionId];
  const next: MissionResult = prev ? { ...prev } : { cleared: true };
  let changed = !prev;
  if (run) {
    if (next.bestTimeMs === undefined || run.timeMs < next.bestTimeMs) { next.bestTimeMs = run.timeMs; changed = true; }
    if (next.bestStars === undefined || run.stars > next.bestStars) { next.bestStars = run.stars; changed = true; }
  }
  if (changed) { p.results[missionId] = next; saveProgress(p); }
}

export function clearedCount(p: Progress): number {
  return Object.keys(p.results).length;
}
