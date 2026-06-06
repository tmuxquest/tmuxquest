export function unquote(v: string): string {
  if (v.length >= 2 &&
      ((v.startsWith('"') && v.endsWith('"')) ||
       (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}
