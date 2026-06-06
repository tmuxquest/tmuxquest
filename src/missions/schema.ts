import type { TmuxState, KeyToken } from '../engine/types';
import type { Goal } from '../engine/goals';
import { evaluateGoal } from '../engine/goals';

export interface Mission {
  id: string;
  title: string;
  chapter: number;
  order: number;
  optional?: boolean;
  teachCopy: string;
  objective: string;
  keys: [string, string][];
  initialState: () => TmuxState;
  goal: Goal;
  steps: { label: string; goal: Goal }[];
  par: number;
  starTimes?: { gold: number; silver: number };
  hints: string[];
  successCopy: string;
  referenceSolution: KeyToken[];
}

function goalIsWellFormed(g: Goal): boolean {
  if (g.kind === 'events') return g.sequence.length > 0;
  if (g.kind === 'all') return g.of.length > 0 && g.of.every(goalIsWellFormed);
  return true;
}

function paneContentWithinCap(m: Mission): boolean {
  let st: TmuxState;
  try { st = m.initialState(); } catch { return false; }
  for (const se of st.sessions)
    for (const w of se.windows) {
      const pc = w.paneContent;
      if (!pc) continue;
      for (const id of Object.keys(pc))
        if ((pc[id]?.length ?? 0) > 100) return false;
    }
  return true;
}

export function validateMission(m: Mission): boolean {
  if (!(
    m.id && m.title && m.teachCopy && m.successCopy &&
    m.objective && Array.isArray(m.keys) && m.keys.length > 0 &&
    typeof m.par === 'number' && m.par > 0 &&
    Array.isArray(m.hints) && m.hints.length > 0 &&
    Array.isArray(m.referenceSolution) && m.referenceSolution.length > 0 &&
    typeof m.initialState === 'function' && m.goal && goalIsWellFormed(m.goal) &&
    Array.isArray(m.steps) && m.steps.length > 0 &&
    m.steps.every(s => s.label && s.goal && goalIsWellFormed(s.goal)) &&
    typeof m.chapter === 'number' &&
    m.chapter >= 1 && m.chapter <= CHAPTERS.length &&
    typeof m.order === 'number' && m.order > 0
  )) return false;
  if (!paneContentWithinCap(m)) return false;
  if (m.starTimes) {
    const { gold, silver } = m.starTimes;
    if (!(typeof gold === 'number' && typeof silver === 'number' && gold > 0 && gold < silver)) return false;
  }
  if (m.steps.some(s => s.label.length > 80)) return false;
  const labels = m.steps.map(s => s.label);
  if (new Set(labels).size !== labels.length) return false;
  const leakRe = /\bprefix\s+(?!(?:to|key|is|was|binding|set|becomes|now|the|its|their|then|or)\b)\S|\bC-[a-z]\b|:[a-z]{2,}\b|`(?:Enter|Space|Backspace)`|\b(?:press|hit|tap|with|then)\s+(?:Enter|Space|Backspace)\b/i;
  if (m.steps.some(s => leakRe.test(s.label))) return false;
  if (/[\x00-\x1f\x7f]/.test(m.successCopy)) return false;
  let initial: TmuxState;
  try { initial = m.initialState(); } catch { return false; }
  if (evaluateGoal(m.goal, initial, [])) return false;
  return true;
}

export const CHAPTERS: { num: number; title: string }[] = [
  { num: 1, title: 'First Steps' },
  { num: 2, title: 'Windows' },
  { num: 3, title: 'Splits & Panes' },
  { num: 4, title: 'Sessions' },
  { num: 5, title: 'Copy-mode' },
  { num: 6, title: 'Command Prompt' },
  { num: 7, title: 'Reshape' },
];
