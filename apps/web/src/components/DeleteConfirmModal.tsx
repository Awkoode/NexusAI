'use client';

import { useAnimatedPresence } from '@/lib/useAnimatedPresence';

interface DeleteConfirmModalProps {
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({ projectName, onConfirm, onCancel }: DeleteConfirmModalProps) {
  const { isClosing, close } = useAnimatedPresence(220, true);
  return (
    <div className={`modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 ${isClosing ? 'is-closing' : ''}`}>
      <div className={`card modal-panel w-full max-w-md p-6 ${isClosing ? 'is-closing' : ''}`}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">Delete project</h3>
            <p className="text-surface-600 dark:text-surface-400 text-sm mt-1">
              Are you sure you want to delete <strong>&quot;{projectName}&quot;</strong>? This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={() => close(onCancel)} className="btn-ghost" disabled={isClosing}>
            Cancel
          </button>
          <button
            onClick={() => close(onConfirm)}
            disabled={isClosing}
            className="btn bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-500 dark:hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}