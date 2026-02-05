'use client';

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  /** If true, requires Ctrl/Cmd modifier */
  ctrl?: boolean;
  /** If true, requires Shift modifier */
  shift?: boolean;
  /** If true, requires Alt modifier */
  alt?: boolean;
  /** Description shown in the help overlay */
  description: string;
  /** Action to execute */
  action: () => void;
}

/**
 * Hook to register keyboard shortcuts.
 * Automatically ignores shortcuts when the user is typing in an input/textarea.
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const tag = (e.target as HTMLElement).tagName;
    const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable;

    for (const shortcut of shortcuts) {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        // Allow Ctrl+K even in inputs (for command bar)
        if (isEditable && !(shortcut.ctrl && shortcut.key === 'k')) {
          return;
        }
        e.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Default app-wide shortcuts registry
export const APP_SHORTCUTS: Omit<KeyboardShortcut, 'action'>[] = [
  { key: 'k', ctrl: true, description: 'Open command bar' },
  { key: '/', description: 'Focus search / filter' },
  { key: '?', shift: true, description: 'Show keyboard shortcuts' },
  { key: 'g', description: 'Go to Dashboard (press g then d)' },
  { key: 'n', description: 'Create new item' },
];
