'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Navigation } from '@/components/Navigation';
import { EmptyState } from '@/components/EmptyState';
import { UploadDatasetModal } from '@/components/UploadDatasetModal';
import { ExperimentFormModal } from '@/components/ExperimentFormModal';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import * as api from '@/lib/api';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ProjectDetailPage({ params }: { params: { projectId: string } }) {
  const [project, setProject] = useState<api.Project | null>(null);
  const [datasets, setDatasets] = useState<api.Dataset[]>([]);
  const [experiments, setExperiments] = useState<api.Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExperimentOpen, setIsExperimentOpen] = useState(false);
  const [deletingDataset, setDeletingDataset] = useState<api.Dataset | null>(null);
  const [deletingExperiment, setDeletingExperiment] = useState<api.Experiment | null>(null);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [p, d, e] = await Promise.all([
        api.getProject(params.projectId),
        api.listDatasets(params.projectId),
        api.listExperiments(params.projectId),
      ]);
      setProject(p);
      setDatasets(d);
      setExperiments(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [params.projectId]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) void fetchAll();
  }, [user, fetchAll]);

  async function handleUpload(file: File, name?: string) {
    await api.uploadDataset(params.projectId, file, name);
    setIsUploadOpen(false);
    await fetchAll();
  }

  async function handleDeleteDataset() {
    if (!deletingDataset) return;
    try {
      await api.deleteDataset(deletingDataset.id);
      setDatasets((prev) => prev.filter((d) => d.id !== deletingDataset.id));
      setDeletingDataset(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dataset');
      setDeletingDataset(null);
    }
  }

  async function handleCreateExperiment(input: api.CreateExperimentInput) {
    await api.createExperiment(input);
    setIsExperimentOpen(false);
    await fetchAll();
  }

  async function handleDeleteExperiment() {
    if (!deletingExperiment) return;
    try {
      await api.deleteExperiment(deletingExperiment.id);
      setExperiments((prev) => prev.filter((e) => e.id !== deletingExperiment.id));
      setDeletingExperiment(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete experiment');
      setDeletingExperiment(null);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-24">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-24">
        <Link href="/projects" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
          ← Back to projects
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50">
              {project?.name ?? 'Project'}
            </h1>
            {project?.description && (
              <p className="text-surface-600 dark:text-surface-400 mt-1">{project.description}</p>
            )}
          </div>
          <button onClick={() => setIsUploadOpen(true)} className="btn-primary">
            + Import CSV
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-4">
          Datasets ({datasets.length})
        </h2>

        {datasets.length === 0 ? (
          <EmptyState
            title="No datasets yet"
            description="Import a CSV file (max 10 MB) to start exploring your data."
            icon="📊"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {datasets.map((d) => (
              <div key={d.id} className="card p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/projects/${params.projectId}/datasets/${d.id}`}
                      className="text-lg font-semibold text-surface-900 dark:text-surface-100 hover:text-primary-600 dark:hover:text-primary-400 truncate block"
                    >
                      {d.name}
                    </Link>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 truncate">
                      {d.originalFilename} · {formatBytes(d.fileSizeBytes)}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                      {d.rowCount ?? '—'} rows · {d.columnCount ?? '—'} cols
                    </p>
                    <span
                      className={`badge mt-2 ${
                        d.status === 'ready'
                          ? 'badge-success'
                          : d.status === 'failed'
                            ? 'badge-error'
                            : 'badge-warning'
                      }`}
                    >
                      {d.status}
                    </span>
                    {d.status === 'failed' && d.errorMessage && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-2">{d.errorMessage}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setDeletingDataset(d)}
                    className="p-2 text-surface-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
                    aria-label="Delete dataset"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-12 mb-4">
          <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-100">
            Experiments ({experiments.length})
          </h2>
          <button onClick={() => setIsExperimentOpen(true)} className="btn-secondary">
            + New experiment
          </button>
        </div>

        {experiments.length === 0 ? (
          <EmptyState
            title="No experiments yet"
            description="Train a regression or classification model on one of your datasets."
            icon="🧪"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {experiments.map((e) => (
              <div key={e.id} className="card p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/projects/${params.projectId}/experiments/${e.id}`}
                      className="text-lg font-semibold text-surface-900 dark:text-surface-100 hover:text-primary-600 dark:hover:text-primary-400 truncate block"
                    >
                      {e.name}
                    </Link>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                      {e.taskType} · {e.modelType} · target: {e.targetColumn}
                    </p>
                    <span
                      className={`badge mt-2 ${
                        e.status === 'completed'
                          ? 'badge-success'
                          : e.status === 'failed'
                            ? 'badge-error'
                            : 'badge-warning'
                      }`}
                    >
                      {e.status}
                    </span>
                    {e.status === 'failed' && e.errorMessage && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-2">{e.errorMessage}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setDeletingExperiment(e)}
                    className="p-2 text-surface-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
                    aria-label="Delete experiment"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {isUploadOpen && (
        <UploadDatasetModal onUpload={handleUpload} onCancel={() => setIsUploadOpen(false)} />
      )}

      {isExperimentOpen && (
        <ExperimentFormModal
          datasets={datasets}
          onSubmit={handleCreateExperiment}
          onCancel={() => setIsExperimentOpen(false)}
        />
      )}

      {deletingDataset && (
        <DeleteConfirmModal
          projectName={deletingDataset.name}
          onConfirm={handleDeleteDataset}
          onCancel={() => setDeletingDataset(null)}
        />
      )}

      {deletingExperiment && (
        <DeleteConfirmModal
          projectName={deletingExperiment.name}
          onConfirm={handleDeleteExperiment}
          onCancel={() => setDeletingExperiment(null)}
        />
      )}
    </div>
  );
}
