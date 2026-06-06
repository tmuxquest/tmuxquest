export type Pos = { row: number; col: number };

export function copyLines(base: string[], cp: { promptLine?: string }): string[] {
  return cp.promptLine != null ? [...base, ...cp.promptLine.split('\n')] : base;
}

export function clampCol(lines: string[], row: number, col: number): number {
  return Math.max(0, Math.min(lines[row]?.length ?? 0, col));
}

export function clampRow(lines: string[], row: number): number {
  return Math.max(0, Math.min(lines.length - 1, row));
}

export function colForGoal(
  lines: string[], row: number, goalCol: number | null | undefined,
): number {
  if (goalCol == null) {
    return lines[row]?.length ?? 0;
  }
  return clampCol(lines, row, goalCol);
}

export function moveH(lines: string[], pos: Pos, dir: -1 | 1): Pos {
  const len = lines[pos.row]?.length ?? 0;
  if (dir === 1) {
    if (pos.col < len) return { row: pos.row, col: pos.col + 1 };
    if (pos.row + 1 < lines.length) return { row: pos.row + 1, col: 0 };
    return { row: pos.row, col: clampCol(lines, pos.row, pos.col) };
  }
  if (pos.col <= 0) {
    if (pos.row > 0) {
      const r = pos.row - 1;
      return { row: r, col: lines[r]?.length ?? 0 };
    }
    return { row: pos.row, col: 0 };
  }
  return { row: pos.row, col: pos.col - 1 };
}

type CharClass = 'word' | 'punct' | 'space';
function classOf(ch: string): CharClass {
  if (/\s/.test(ch)) return 'space';
  if (/\w/.test(ch)) return 'word';
  return 'punct';
}

export function nextWordStart(lines: string[], pos: Pos): Pos {
  let { row, col } = pos;
  let line = lines[row] ?? '';
  if (col < line.length && classOf(line[col]!) !== 'space') {
    const cls = classOf(line[col]!);
    while (col < line.length && classOf(line[col]!) === cls) col++;
  }
  while (true) {
    line = lines[row] ?? '';
    while (col < line.length && classOf(line[col]!) === 'space') col++;
    if (col < line.length) return { row, col };
    if (row + 1 >= lines.length) return { row, col: lastNonSpaceCol(line) };
    row += 1; col = 0;
  }
}

function lastNonSpaceCol(line: string): number {
  for (let i = line.length - 1; i >= 0; i--) {
    if (classOf(line[i]!) !== 'space') return i;
  }
  return 0;
}

export function prevWordStart(lines: string[], pos: Pos): Pos {
  let { row, col } = pos;
  if (col > 0) col -= 1;
  else if (row > 0) { row -= 1; col = Math.max(0, (lines[row]?.length ?? 0) - 1); }
  else return { row: 0, col: 0 };
  while (true) {
    const line = lines[row] ?? '';
    while (col >= 0 && col < line.length && classOf(line[col]!) === 'space') col -= 1;
    if (col >= 0 && col < line.length) break;
    if (row === 0) return { row: 0, col: 0 };
    row -= 1; col = Math.max(0, (lines[row]?.length ?? 0) - 1);
  }
  const line = lines[row]!;
  const cls = classOf(line[col]!);
  while (col > 0 && classOf(line[col - 1]!) === cls) col -= 1;
  return { row, col };
}

export function wordEnd(lines: string[], pos: Pos): Pos {
  let { row, col } = pos;
  let line = lines[row] ?? '';
  const onSpace = col >= line.length || classOf(line[col]!) === 'space';
  if (!onSpace) {
    const cls = classOf(line[col]!);
    const atLast = col + 1 >= line.length || classOf(line[col + 1]!) !== cls;
    if (!atLast) {
      while (col + 1 < line.length && classOf(line[col + 1]!) === cls) col += 1;
      return { row, col };
    }
    col += 1;
  }
  while (true) {
    line = lines[row] ?? '';
    while (col < line.length && classOf(line[col]!) === 'space') col += 1;
    if (col < line.length) break;
    if (row + 1 >= lines.length) return { row, col: lastNonSpaceCol(line) };
    row += 1; col = 0;
  }
  const cls = classOf(line[col]!);
  while (col + 1 < line.length && classOf(line[col + 1]!) === cls) col += 1;
  return { row, col };
}

export function yankRangeChar(lines: string[], a: Pos, b: Pos): string {
  const [lo, hi] = (a.row < b.row || (a.row === b.row && a.col <= b.col))
    ? [a, b] : [b, a];
  if (lo.row === hi.row) {
    return (lines[lo.row] ?? '').slice(lo.col, hi.col + 1);
  }
  const out: string[] = [];
  out.push((lines[lo.row] ?? '').slice(lo.col));
  for (let r = lo.row + 1; r < hi.row; r++) out.push(lines[r] ?? '');
  out.push((lines[hi.row] ?? '').slice(0, hi.col + 1));
  return out.join('\n');
}

export function yankRangeLine(lines: string[], a: Pos, b: Pos): string {
  const lo = Math.min(a.row, b.row);
  const hi = Math.max(a.row, b.row);
  return lines.slice(lo, hi + 1).join('\n');
}

export function yankSelection(
  lines: string[],
  selectMode: 'char' | 'line',
  anchor: Pos,
  cursor: Pos,
): string {
  if (lines.length === 0) return '';
  return selectMode === 'line'
    ? yankRangeLine(lines, anchor, cursor)
    : yankRangeChar(lines, anchor, cursor);
}
