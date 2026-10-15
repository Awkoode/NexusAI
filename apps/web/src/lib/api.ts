'use client';

import { supabase } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  let accessToken: string | null = null;

  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    accessToken = session?.access_token ?? null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type DatasetStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

export interface Dataset {
  id: string;
  projectId: string;
  name: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  rowCount: number | null;
  columnCount: number | null;
  status: DatasetStatus;
  errorMessage?: string | null;
  schemaJson?: {
    columns: {
      name: string;
      index: number;
      type: string;
      nonNullCount: number;
      nullCount: number;
      distinctCount: number;
    }[];
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetPreview {
  datasetId: string;
  headers: string[];
  columnTypes: string[];
  rows: string[][];
  totalRows: number;
  previewRowCount: number;
  limit: number;
  offset: number;
}

export interface DatasetColumnProfile {
  name: string;
  index: number;
  type: string;
  nonNullCount: number;
  nullCount: number;
  distinctCount: number;
  numericStats?: {
    count: number;
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    q1: number;
    q3: number;
    distinctCount: number;
  };
  categoricalStats?: {
    count: number;
    distinctCount: number;
    topValues: { value: string; count: number; frequency: number }[];
  };
}

export interface DatasetProfile {
  datasetId: string;
  rowCount: number;
  columnCount: number;
  totalCells: number;
  missingCells: number;
  missingPercentage: number;
  numericColumnCount: number;
  categoricalColumnCount: number;
  fileSizeBytes: number;
  columns: DatasetColumnProfile[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    version: string;
  };
}

export async function listProjects(): Promise<Project[]> {
  const response = await fetchWithAuth('/api/v1/projects');
  const data: ApiResponse<Project[]> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to fetch projects');
  }

  return data.data || [];
}

export async function createProject(name: string, description?: string): Promise<Project> {
  const response = await fetchWithAuth('/api/v1/projects', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
  const data: ApiResponse<Project> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to create project');
  }

  return data.data!;
}

export async function getProject(id: string): Promise<Project> {
  const response = await fetchWithAuth(`/api/v1/projects/${id}`);
  const data: ApiResponse<Project> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to fetch project');
  }

  return data.data!;
}

export async function updateProject(id: string, name?: string, description?: string): Promise<Project> {
  const response = await fetchWithAuth(`/api/v1/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, description }),
  });
  const data: ApiResponse<Project> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to update project');
  }

  return data.data!;
}

export async function deleteProject(id: string): Promise<void> {
  const response = await fetchWithAuth(`/api/v1/projects/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    const data: ApiResponse<null> = await response.json();
    throw new Error(data.error?.message || 'Failed to delete project');
  }
}

export async function listDatasets(projectId: string): Promise<Dataset[]> {
  const response = await fetchWithAuth(`/api/v1/projects/${projectId}/datasets`);
  const data: ApiResponse<Dataset[]> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to fetch datasets');
  }

  return data.data || [];
}

export async function uploadDataset(
  projectId: string,
  file: File,
  name?: string
): Promise<Dataset> {
  let accessToken: string | null = null;
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    accessToken = session?.access_token ?? null;
  }

  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);

  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await fetch(`${API_URL}/api/v1/projects/${projectId}/datasets`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data: ApiResponse<Dataset> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to upload dataset');
  }

  return data.data!;
}

export async function getDataset(datasetId: string): Promise<Dataset> {
  const response = await fetchWithAuth(`/api/v1/datasets/${datasetId}`);
  const data: ApiResponse<Dataset> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to fetch dataset');
  }

  return data.data!;
}

export async function getDatasetPreview(
  datasetId: string,
  limit = 20,
  offset = 0
): Promise<DatasetPreview> {
  const response = await fetchWithAuth(
    `/api/v1/datasets/${datasetId}/preview?limit=${limit}&offset=${offset}`
  );
  const data: ApiResponse<DatasetPreview> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to fetch dataset preview');
  }

  return data.data!;
}

export async function getDatasetProfile(datasetId: string): Promise<DatasetProfile> {
  const response = await fetchWithAuth(`/api/v1/datasets/${datasetId}/profile`);
  const data: ApiResponse<DatasetProfile> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to fetch dataset profile');
  }

  return data.data!;
}

export async function deleteDataset(datasetId: string): Promise<void> {
  const response = await fetchWithAuth(`/api/v1/datasets/${datasetId}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    const data: ApiResponse<null> = await response.json();
    throw new Error(data.error?.message || 'Failed to delete dataset');
  }
}

export type ExperimentTaskType = 'regression' | 'classification';
export type ExperimentStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Experiment {
  id: string;
  projectId: string;
  datasetId: string;
  name: string;
  taskType: ExperimentTaskType;
  modelType: string;
  targetColumn: string;
  featureColumns: string[];
  config: { testSize: number; randomState: number };
  status: ExperimentStatus;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  latestRun?: ModelRun | null;
}

export interface ModelRun {
  id: string;
  experimentId: string;
  status: 'running' | 'completed' | 'failed';
  metrics?: Record<string, unknown> | null;
  trainSamples?: number | null;
  testSamples?: number | null;
  modelParams?: Record<string, unknown> | null;
  predictionsSummary?: {
    count: number;
    actualMean?: number | null;
    predictedMean?: number | null;
    sample: (number | string)[][];
  } | null;
  trainSeconds?: number | null;
  libraryVersions?: Record<string, string> | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface CreateExperimentInput {
  projectId: string;
  datasetId: string;
  name?: string;
  taskType: ExperimentTaskType;
  modelType: string;
  targetColumn: string;
  featureColumns: string[];
  testSize?: number;
  randomState?: number;
}

export const REGRESSION_MODELS = ['linear_regression', 'random_forest_regressor'];
export const CLASSIFICATION_MODELS = ['logistic_regression', 'random_forest_classifier'];

export async function createExperiment(input: CreateExperimentInput): Promise<Experiment> {
  const response = await fetchWithAuth('/api/v1/experiments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const data: ApiResponse<Experiment> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to create experiment');
  }

  return data.data!;
}

export async function listExperiments(projectId: string): Promise<Experiment[]> {
  const response = await fetchWithAuth(`/api/v1/projects/${projectId}/experiments`);
  const data: ApiResponse<Experiment[]> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to fetch experiments');
  }

  return data.data || [];
}

export async function getExperiment(experimentId: string): Promise<Experiment> {
  const response = await fetchWithAuth(`/api/v1/experiments/${experimentId}`);
  const data: ApiResponse<Experiment> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to fetch experiment');
  }

  return data.data!;
}

export async function listExperimentRuns(experimentId: string): Promise<ModelRun[]> {
  const response = await fetchWithAuth(`/api/v1/experiments/${experimentId}/runs`);
  const data: ApiResponse<ModelRun[]> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to fetch runs');
  }

  return data.data || [];
}

export async function runExperiment(experimentId: string): Promise<Experiment> {
  const response = await fetchWithAuth(`/api/v1/experiments/${experimentId}/run`, {
    method: 'POST',
  });
  const data: ApiResponse<Experiment> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to run experiment');
  }

  return data.data!;
}

export async function deleteExperiment(experimentId: string): Promise<void> {
  const response = await fetchWithAuth(`/api/v1/experiments/${experimentId}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    const data: ApiResponse<null> = await response.json();
    throw new Error(data.error?.message || 'Failed to delete experiment');
  }
}

export type AnalysisType =
  | 'describe'
  | 'correlation'
  | 'covariance'
  | 'linear_algebra'
  | 'compare';

export interface AnalysisRun {
  id: string;
  projectId: string;
  datasetId: string;
  analysisType: AnalysisType;
  engine: 'julia' | 'python' | 'comparison';
  config: {
    columns?: string[];
    missingPolicy?: string;
    maxRows?: number;
  };
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: Record<string, unknown> | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface RunAnalysisInput {
  datasetId: string;
  analysisType: AnalysisType;
  columns?: string[];
  missingPolicy?: 'pairwise' | 'listwise';
  maxRows?: number;
}

export async function runAnalysis(
  projectId: string,
  input: RunAnalysisInput
): Promise<AnalysisRun> {
  const response = await fetchWithAuth(`/api/v1/projects/${projectId}/analyses`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const data: ApiResponse<AnalysisRun> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to run analysis');
  }

  return data.data!;
}

export async function listAnalyses(projectId: string): Promise<AnalysisRun[]> {
  const response = await fetchWithAuth(`/api/v1/projects/${projectId}/analyses`);
  const data: ApiResponse<AnalysisRun[]> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to fetch analyses');
  }

  return data.data || [];
}

export async function getAnalysis(analysisId: string): Promise<AnalysisRun> {
  const response = await fetchWithAuth(`/api/v1/analyses/${analysisId}`);
  const data: ApiResponse<AnalysisRun> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to fetch analysis');
  }

  return data.data!;
}

export async function deleteAnalysis(analysisId: string): Promise<void> {
  const response = await fetchWithAuth(`/api/v1/analyses/${analysisId}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    const data: ApiResponse<null> = await response.json();
    throw new Error(data.error?.message || 'Failed to delete analysis');
  }
}

export type JobType =
  | 'dataset.profile'
  | 'ml.train'
  | 'analysis.describe'
  | 'analysis.correlation'
  | 'analysis.covariance'
  | 'analysis.linear-algebra'
  | 'analysis.compare';

export type JobStatus =
  | 'queued'
  | 'active'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'cancel_requested';

const TERMINAL_JOB_STATUSES: JobStatus[] = ['completed', 'failed', 'cancelled'];

export function isTerminalJobStatus(status: JobStatus): boolean {
  return TERMINAL_JOB_STATUSES.includes(status);
}

export interface Job {
  id: string;
  userId: string;
  projectId?: string | null;
  datasetId?: string | null;
  jobType: JobType;
  status: JobStatus;
  params: Record<string, unknown>;
  progress: number;
  stage?: string | null;
  result?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface CreateJobInput {
  jobType: JobType;
  projectId: string;
  datasetId: string;
  [key: string]: unknown;
}

export interface JobsPage {
  jobs: Job[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  const response = await fetchWithAuth(`/api/v1/jobs`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const data: ApiResponse<Job> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to create job');
  }

  return data.data!;
}

export async function listJobs(page = 1, limit = 20, projectId?: string): Promise<JobsPage> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (projectId) params.set('projectId', projectId);
  const response = await fetchWithAuth(`/api/v1/jobs?${params.toString()}`);
  const data: ApiResponse<JobsPage> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to fetch jobs');
  }

  return data.data!;
}

export async function getJob(jobId: string): Promise<Job> {
  const response = await fetchWithAuth(`/api/v1/jobs/${jobId}`);
  const data: ApiResponse<Job> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to fetch job');
  }

  return data.data!;
}

export async function cancelJob(jobId: string): Promise<Job> {
  const response = await fetchWithAuth(`/api/v1/jobs/${jobId}/cancel`, {
    method: 'POST',
  });
  const data: ApiResponse<Job> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to cancel job');
  }

  return data.data!;
}