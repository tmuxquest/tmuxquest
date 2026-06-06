export type KeyToken = string;

export interface Rect { x: number; y: number; w: number; h: number; }

export interface Pane { id: string; contentId: string; }

export type PresetName = 'even-h' | 'even-v' | 'main-h' | 'main-v' | 'tiled';

export type LayoutNode =
  | { kind: 'leaf'; paneId: string }
  | { kind: 'split'; dir: 'v' | 'h'; ratio: number; a: LayoutNode; b: LayoutNode };

export interface Window {
  id: string; name: string;
  createdAt: number;
  layout: LayoutNode;
  activePaneId: string;
  zoomedPaneId: string | null;
  lastPaneId?: string;
  paneContent?: Record<string, string[]>;
  paneCwd?: Record<string, string>;
  currentLayout?: PresetName;
  paneRoles?: Record<string, string>;
}

export interface Session {
  id: string; name: string;
  createdAt: number;
  windows: Window[];
  activeWindowId: string;
  lastWindowId?: string;
}

export type HookName =
  | 'pane-died' | 'pane-exited'
  | 'pane-focus-in' | 'pane-focus-out'
  | 'client-attached' | 'client-detached'
  | 'session-created' | 'session-renamed' | 'session-closed'
  | 'window-renamed' | 'window-pane-changed';

export interface CopyState {
  paneId: string;
  cursor: { row: number; col: number };
  anchor: { row: number; col: number } | null;
  selectMode: 'char' | 'line';
  search: string | null;
  searchActive: boolean;
  searchDir?: 'fwd' | 'bwd';
  goalCol?: number | null;
  promptLine?: string;
}

export interface TmuxState {
  sessions: Session[];
  attachedSessionId: string | null;
  activeSessionId: string;
  mode: 'normal' | 'prefix' | 'rename' | 'command' | 'confirm' | 'repeat' | 'copy' | 'tree' | 'find' | 'display-panes' | 'popup' | 'menu';
  renameTarget?: 'window' | 'session';
  options: Record<string, string>;
  hooks: Partial<Record<HookName, string>>;
  displayPanesDeadline?: number;
  repeatDeadline?: number;
  buffer: string;
  bufferCursor?: number;
  nextId: number;
  statusMessage?: string;
  confirm?: {
    kind: 'kill-window' | 'kill-pane' | 'tree-kill' | 'tree-kill-tagged';
    prompt: string;
    returnTo?: 'normal' | 'tree';
    target?: { sessionId: string; windowId?: string };
    targets?: { sessionId: string; windowId?: string }[];
  };
  minCopyCursorRow?: number;
  copyReturnedToBottom?: boolean;
  copy?: CopyState;
  copyByPane?: Record<string, CopyState>;
  pasteBuffer?: string;
  lastPaste?: string;
  pasteBuffers?: { name: string; text: string }[];
  nextBufferIdx?: number;
  tree?: TreeState;
  menu?: {
    paneId: string;
    title: string;
    items: PaneMenuItem[];
    cursor: number;
  };
  prefixKey: KeyToken;
  cmdMenuCursor?: number;
  cmdMenuOpen?: boolean;
  popup?: {
    content: string[];
    cmd?: string;
    cwd: string;
    closeOnExit?: boolean;
    width?: number;
    height?: number;
  };
}

export interface PaneMenuItem {
  label: string;
  key: string;
  command: string;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export interface TreeState {
  kind: 'session' | 'window';
  cursor: number;
  expanded: Record<string, boolean>;
  tagged: Record<string, true>;
  filter: string;
  filterMode: boolean;
  sortMode: 'index' | 'name' | 'time';
  reverseSort: boolean;
  showPreview: boolean;
}

export type GameEvent =
  | { type: 'detached' }
  | { type: 'attached'; sessionId: string }
  | { type: 'window-created'; windowId: string }
  | { type: 'window-switched'; windowId: string }
  | { type: 'window-renamed'; name: string }
  | { type: 'window-killed' }
  | { type: 'pane-split'; dir: 'v' | 'h' }
  | { type: 'pane-closed' }
  | { type: 'pane-navigated'; paneId: string }
  | { type: 'pane-zoom-toggled'; zoomed: boolean }
  | { type: 'session-created'; sessionId: string; name: string }
  | { type: 'session-switched'; sessionId: string }
  | { type: 'session-renamed'; name: string }
  | { type: 'session-killed' }
  | { type: 'copy-mode-entered' }
  | { type: 'copy-mode-exited' }
  | { type: 'copy-searched' }
  | { type: 'text-copied'; text: string }
  | { type: 'text-pasted'; text: string }
  | { type: 'window-swapped'; aIdx: number; bIdx: number }
  | { type: 'window-moved'; fromIdx: number; toIdx: number }
  | { type: 'tree-opened'; kind: 'session' | 'window' }
  | { type: 'find-opened' }
  | { type: 'layout-applied'; preset: PresetName }
  | { type: 'pane-broken'; windowId: string }
  | { type: 'pane-joined'; fromWindowId: string; toWindowId: string }
  | { type: 'pane-swapped'; aPaneId: string; bPaneId: string }
  | { type: 'pane-resized'; paneId: string; dir: 'L' | 'R' | 'U' | 'D'; amount: number }
  | { type: 'display-panes-entered' }
  | { type: 'popup-opened'; cmd?: string }
  | { type: 'popup-closed' }
  | { type: 'hook-fired'; name: string }
  | { type: 'menu-opened'; paneId: string }
  | { type: 'menu-closed' }
  | { type: 'brief-opened' }
  | { type: 'brief-closed' };

export interface DispatchResult { state: TmuxState; events: GameEvent[]; }

export interface SegmentStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underscore?: boolean;
  reverse?: boolean;
}
export interface Segment { text: string; style?: SegmentStyle; }
