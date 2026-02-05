'use client';

import { useState, useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import { APP_SHORTCUTS } from '@/hooks/useKeyboardShortcuts';

export default function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-gray-500" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close keyboard shortcuts"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Shortcuts list */}
          <div className="px-6 py-4 space-y-3">
            {APP_SHORTCUTS.map((shortcut) => (
              <div key={`${shortcut.key}-${shortcut.ctrl}-${shortcut.shift}`} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{shortcut.description}</span>
                <kbd className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600">
                  {shortcut.ctrl && <span>Ctrl+</span>}
                  {shortcut.shift && <span>Shift+</span>}
                  {shortcut.alt && <span>Alt+</span>}
                  <span>{shortcut.key.toUpperCase()}</span>
                </kbd>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <p className="text-xs text-gray-400 text-center">
              Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">?</kbd> to toggle this dialog
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
