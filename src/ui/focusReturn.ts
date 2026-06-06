export function focusReturn(_node: HTMLElement): { destroy: () => void } {
  const previous = document.activeElement as HTMLElement | null;

  return {
    destroy() {
      if (!previous) return;
      if (previous === document.body) return;
      if (!document.contains(previous)) return;
      previous.focus();
    },
  };
}
