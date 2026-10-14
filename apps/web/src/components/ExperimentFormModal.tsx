'use client';

import { useState, useEffect } from 'react';
import * as api from '@/lib/api';

interface ExperimentFormModalProps {
  datasets: api.Dataset[];
  onSubmit: (input: api.CreateExperimentInput) => Promise<void>;
  onCancel: () => void;
}

export function ExperimentFormModal({ datasets, onSubmit, onCancel }: ExperimentFormModalProps) {
  const readyDatasets = datasets.filter((d) => d.status === 'ready');
  const [datasetId, setDatasetId] = useState(readyDatasets[0]?.id ?? '');
  const [taskType, setTaskType] = useState<api.ExperimentTaskType>('regression');
  const [modelType, setModelType] = useState('linear_regression');
  const [targetColumn, setTargetColumn] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [testSize, setTestSize] = useState(0.2);
  const [randomState, setRandomState] = useState(42);
  const [name, setName] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const models = taskType === 'regression' ? api.REGRESSION_MODELS : api.CLASSIFICATION_MODELS;

  useEffect(() => {
    setModelType(taskType === 'regression' ? 'linear_regression' : 'logistic_regression');
  }, [taskType]);

  useEffect(() => {
    if (!datasetId) {
      setColumns([]);
      return;
    }
    setLoadingColumns(true);
    api
      .getDatasetPreview(datasetId, 1, 0)
      .then((p) => {
        setColumns(p.headers);
        setTargetColumn('');
        setSelectedFeatures([]);
      })
      .catch(() => setColumns([]))
      .finally(() => setLoadingColumns(false));
  }, [datasetId]);

  function toggleFeature(col: string) {
    setSelectedFeatures((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!datasetId) {
      setError('Select a dataset');
      return;
    }
    if (!targetColumn) {
      setError('Select a target column');
      return;
    }
    if (selectedFeatures.length === 0) {
      setError('Select at least one feature');
      return;
    }
    setIsSubmitting(true);
    try {
      const projectId = datasets.find((d) => d.id === datasetId)?.projectId ?? '';
      await onSubmit({
        projectId,
        datasetId,
        name: name.trim() || undefined,
        taskType,
        modelType,
        targetColumn,
        featureColumns: selectedFeatures,
        testSize,
        randomState,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create experiment');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="card w-full max-w-lg p-6 my-8">
        <h2 className="text-xl font-bold text-surface-900 dark:text-surface-50 mb-6">
          New experiment
        </h2>

        {readyDatasets.length === 0 ? (
          <div>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Import a CSV dataset first — only ready datasets can be used for training.
            </p>
            <div className="flex justify-end mt-6">
              <button onClick={onCancel} className="btn-ghost">Close</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="exp-dataset" className="label">Dataset</label>
              <select
                id="exp-dataset"
                value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
                className="input"
              >
                {readyDatasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.rowCount ?? '?'} rows)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="exp-task" className="label">Task</label>
                <select
                  id="exp-task"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as api.ExperimentTaskType)}
                  className="input"
                >
                  <option value="regression">Regression</option>
                  <option value="classification">Classification</option>
                </select>
              </div>
              <div>
                <label htmlFor="exp-model" className="label">Model</label>
                <select
                  id="exp-model"
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value)}
                  className="input"
                >
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="exp-target" className="label">
                Target column {taskType === 'regression' ? '(numeric)' : '(categorical)'}
              </label>
              <select
                id="exp-target"
                value={targetColumn}
                onChange={(e) => setTargetColumn(e.target.value)}
                className="input"
                disabled={loadingColumns}
              >
                <option value="">Select…</option>
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <span className="label">Features</span>
              {loadingColumns ? (
                <p className="text-sm text-surface-500">Loading columns…</p>
              ) : (
                <div className="max-h-40 overflow-y-auto border border-surface-200 dark:border-surface-700 rounded-lg p-2 space-y-1">
                  {columns
                    .filter((c) => c !== targetColumn)
                    .map((c) => (
                      <label key={c} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedFeatures.includes(c)}
                          onChange={() => toggleFeature(c)}
                        />
                        {c}
                      </label>
                    ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="exp-testsize" className="label">Test size ({testSize.toFixed(2)})</label>
                <input
                  id="exp-testsize"
                  type="range"
                  min={0.1}
                  max={0.5}
                  step={0.05}
                  value={testSize}
                  onChange={(e) => setTestSize(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label htmlFor="exp-seed" className="label">Seed</label>
                <input
                  id="exp-seed"
                  type="number"
                  min={0}
                  value={randomState}
                  onChange={(e) => setRandomState(Number(e.target.value))}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label htmlFor="exp-name" className="label">Name (optional)</label>
              <input
                id="exp-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Auto-generated if empty"
                maxLength={200}
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={onCancel} className="btn-ghost" disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Training…' : 'Create & train'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
