import { MISSIONS } from '../../missions/missions';
import type { Mission } from '../../missions/schema';

export const SHELL_HOME = '~/tmuxquest';

export interface Line {
  text: string;
  cls?: string;
  parts?: { text: string; cls?: string }[];
}

export interface MissionDir {
  _idx: number;
  _cleared: boolean;
  'brief.md': Line[];
}
export interface ShellFS {
  missions: Record<string, MissionDir>;
}

export interface ProgressLike { results: Record<string, unknown> }

export interface CmdResult {
  output: Line[];
  cwd?: string;
  clear?: boolean;
  closing?: boolean;
}

export interface Completions {
  matches: string[];
  before: string;
  base: string;
  frag: string;
}

export function missionDirName(m: Mission, i: number): string {
  const slug = m.id.replace(/^m\d+-?/, '');
  return String(i + 1).padStart(2, '0') + '-' + slug;
}

export function isUnlocked(i: number, progress: ProgressLike): boolean {
  return i === 0 || !!progress.results[MISSIONS[i - 1]!.id];
}

export function buildShellFS(progress: ProgressLike): ShellFS {
  const missions: Record<string, MissionDir> = {};
  MISSIONS.forEach((m, i) => {
    if (!isUnlocked(i, progress)) return;
    missions[missionDirName(m, i)] = {
      _idx: i,
      _cleared: !!progress.results[m.id],
      'brief.md': [],
    };
  });
  return { missions };
}

export function inShellRoot(cwd: string): boolean {
  return cwd === SHELL_HOME;
}
export function shellDirName(cwd: string): string | null {
  return inShellRoot(cwd) ? null : cwd.slice(SHELL_HOME.length + 1);
}

export function dirsByIdx(fs: ShellFS): string[] {
  return Object.keys(fs.missions).sort((a, b) => fs.missions[a]!._idx - fs.missions[b]!._idx);
}

export function commonPrefix(arr: string[]): string {
  if (!arr.length) return '';
  let p = arr[0]!;
  for (let i = 1; i < arr.length; i++) {
    const s = arr[i]!;
    let k = 0;
    while (k < p.length && k < s.length && p[k] === s[k]) k++;
    p = p.slice(0, k);
    if (!p) return '';
  }
  return p;
}

export function getCompletions(input: string, cwd: string, fs: ShellFS): Completions {
  const m = input.match(/^(.*?)(\S*)$/);
  if (!m) return { matches: [], before: input, base: '', frag: '' };
  const before = m[1]!;
  const word = m[2]!;
  const slash = word.lastIndexOf('/');
  const base = slash >= 0 ? word.slice(0, slash + 1) : '';
  const frag = slash >= 0 ? word.slice(slash + 1) : word;

  const baseClean = base
    .replace(/^\.\//, '')
    .replace(/^~\/tmuxquest\/?/, '')
    .replace(/\/$/, '');
  const wantsRoot = /^~(\/?tmuxquest\/?)?$/.test(base) || base === '~/tmuxquest/';

  let dirContents: string[] = [];
  if (baseClean === '') {
    if (wantsRoot || inShellRoot(cwd) || base === '' || base === './') {
      if (inShellRoot(cwd) || wantsRoot) {
        dirContents = dirsByIdx(fs).map(d => d + '/');
      } else {
        const d = fs.missions[shellDirName(cwd)!];
        dirContents = d ? Object.keys(d).filter(k => !k.startsWith('_')) : [];
      }
    }
  } else if (fs.missions[baseClean]) {
    dirContents = Object.keys(fs.missions[baseClean]!).filter(k => !k.startsWith('_'));
  }

  const matches = dirContents.filter(c => c.startsWith(frag));
  matches.sort((a, b) => a.localeCompare(b));
  return { matches, before, base, frag };
}

