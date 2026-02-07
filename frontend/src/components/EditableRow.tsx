'use client';

import { useCallback, KeyboardEvent, ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface EditableRowProps {
  /** The <tr> children (typically EditableCell components inside <td>s) */
  children: ReactNode;
  /** Additional class names for the <tr> */
  className?: string;
  /** Called when the user presses Ctrl+Enter anywhere in the row */
  onRowSave?: () => void;
  /** Called when the user presses Ctrl+Escape anywhere in the row */
  onRowCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
/**
 * EditableRow wraps a table row and listens for row-level keyboard shortcuts.
 *
 *  - Ctrl+Enter  => calls onRowSave  (useful for "save entire row")
 *  - Ctrl+Escape => calls onRowCancel (useful for "cancel all edits in row")
 *
 * Individual EditableCell components handle their own Enter/Escape for
 * cell-level save/cancel. This wrapper adds *row-level* coordination when
 * needed.
 */
export default function EditableRow({
  children,
  className = '',
  onRowSave,
  onRowCancel,
}: EditableRowProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTableRowElement>) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter' && onRowSave) {
          e.preventDefault();
          e.stopPropagation();
          onRowSave();
        }
        if (e.key === 'Escape' && onRowCancel) {
          e.preventDefault();
          e.stopPropagation();
          onRowCancel();
        }
      }
    },
    [onRowSave, onRowCancel],
  );

  return (
    <tr
      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${className}`}
      onKeyDown={handleKeyDown}
    >
      {children}
    </tr>
  );
}
