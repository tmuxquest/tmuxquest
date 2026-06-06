export function buildPromptLine(cwd: string, input: string): string {
  return '➜ ' + cwd + ' ' + input + ' ';
}

export function promptCaretCol(cwd: string, caretPos: number): number {
  return 3 + cwd.length + caretPos;
}
