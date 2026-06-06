export type Segment = { kind: 'text' | 'code'; value: string };

export function segmentLine(line: string): Segment[] {
  const out: Segment[] = [];
  let buf = '';
  let i = 0;
  while (i < line.length) {
    if (line[i] === '`') {
      const j = line.indexOf('`', i + 1);
      if (j === -1) { buf += line[i]; i++; continue; }
      if (buf) { out.push({ kind: 'text', value: buf }); buf = ''; }
      out.push({ kind: 'code', value: line.slice(i + 1, j) });
      i = j + 1;
    } else {
      buf += line[i++];
    }
  }
  if (buf) out.push({ kind: 'text', value: buf });
  return out;
}
