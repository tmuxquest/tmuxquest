import type { Mission } from '../missions/schema';

export const STAR_BASE_MS = 3000;
export const STAR_PER_KEY_MS = 900;
export const STAR_GOLD_RATIO = 0.55;

export interface StarThresholds { gold: number; silver: number }
export type Stars = 1 | 2 | 3;

export function thresholdsFor(mission: Mission): StarThresholds {
  if (mission.starTimes) return { ...mission.starTimes };
  const silver = STAR_BASE_MS + mission.par * STAR_PER_KEY_MS;
  const gold = Math.round(STAR_GOLD_RATIO * silver);
  return { gold, silver };
}

export function starsFor(elapsedMs: number, t: StarThresholds): Stars {
  if (elapsedMs <= t.gold) return 3;
  if (elapsedMs <= t.silver) return 2;
  return 1;
}

export interface MedalTarget {
  stars: Stars;
  threshold: number | null;
}

export function nextMedal(elapsedMs: number, t: StarThresholds): MedalTarget {
  const stars = starsFor(elapsedMs, t);
  const threshold = stars === 3 ? t.gold : stars === 2 ? t.silver : null;
  return { stars, threshold };
}
