const CAP = 100;

let list = $state<string[]>([]);

export const shellHistory = {
  get list(): readonly string[] {
    return list;
  },

  push(cmd: string): void {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    if (list[0] === trimmed) return;
    list = [trimmed, ...list].slice(0, CAP);
  },

  clear(): void {
    list = [];
  },
};
