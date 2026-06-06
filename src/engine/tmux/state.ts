import type { TmuxState, Session } from '../types';
import { newWindow } from './window';

export const DEFAULT_OPTIONS: Record<string, string> = {
  'status-left':                '[#S] ',
  'status-right':               '"#H" %H:%M %d-%b-%y',
  'status-left-length':         '10',
  'status-right-length':        '40',
  'status-style':               'bg=green,fg=black',
  'window-status-style':        '',
  'window-status-current-style':'',
  'window-status-format':       '#I:#W#{?window_flags,#{window_flags}, }',
  'window-status-current-format':'#I:#W#{?window_flags,#{window_flags}, }',
  'status-position':            'bottom',
  'mouse':                      'on',
  'mode-keys':                  'vi',
};

export function createInitialState(): TmuxState {
  const s: TmuxState = {
    sessions: [], attachedSessionId: null, activeSessionId: '',
    mode: 'normal', buffer: '', nextId: 1,
    prefixKey: 'C-b',
    options: { ...DEFAULT_OPTIONS }, hooks: {},
  };
  const sid = `s${s.nextId++}`;
  const w = newWindow(s, 'bash');
  const sess: Session = { id: sid, name: 'main', createdAt: Date.now(),
    windows: [w], activeWindowId: w.id };
  s.sessions = [sess];
  s.attachedSessionId = sid; s.activeSessionId = sid;
  return s;
}
