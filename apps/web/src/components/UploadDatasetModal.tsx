'use client';

import { useState } from 'react';

interface UploadDatasetModalProps {
  onUpload: (file: File, name?: string) => Promise<void>;
  onCancel: () => void;
}

const MAX_UPLOAD_MB = 10;

export function UploadDatasetModal({ onUpload, onCancel }: UploadDatasetModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`File exceeds the ${MAX_UPLOAD_MB} MB limit`);
      setFile(null);
      return;
    }
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setError('Only .csv files are supported');
      setFile(null);
      return;
    }
    setFile(selected);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Select a CSV file first');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await onUpload(file, name.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload dataset');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-surface-900 dark:text-surface-50 mb-2">
          Import CSV dataset
        </h2>
        <p className="text-sm text-surface-600 dark:text-surface-400 mb-6">
          Max {MAX_UPLOAD_MB} MB. The file is processed securely on the server and stored privately.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="dataset-file" className="label">CSV file</label>
            <input
              id="dataset-file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="input"
            />
            {file && (
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                {file.name} — {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>

          <div>
            <label htmlFor="dataset-name" className="label">Display name (optional)</label>
            <input
              id="dataset-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Defaults to the file name"
              maxLength={200}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" onClick={onCancel} className="btn-ghost" disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading || !file}>
              {isLoading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
