/**
 * Shared types and contracts for NexusAI
 * This package is used by both the web frontend and the API backend
 */

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
  version: string;
}

// ============================================
// Health Check Types
// ============================================

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  checks?: HealthCheckDetail[];
}

export interface HealthCheckDetail {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  componentType?: string;
  observedValue?: string | number;
  observedUnit?: string;
  threshold?: string;
  details?: Record<string, unknown>;
}

export interface ReadinessResponse {
  ready: boolean;
  service: string;
  version: string;
  timestamp: string;
  dependencies: DependencyCheck[];
}

export interface DependencyCheck {
  name: string;
  ready: boolean;
  latencyMs?: number;
  error?: string;
}

// ============================================
// Pagination Types
// ============================================

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================
// Project Types
// ============================================

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  datasetCount: number;
  experimentCount: number;
}

export interface ProjectDetail extends ProjectSummary {
  datasets: DatasetSummary[];
  experiments: ExperimentSummary[];
}

export interface DatasetSummary {
  id: string;
  name: string;
  filename: string;
  rows: number;
  columns: number;
  sizeBytes: number;
  createdAt: string;
}

export interface ExperimentSummary {
  id: string;
  name: string;
  type: ExperimentType;
  status: ExperimentStatus;
  createdAt: string;
  completedAt?: string;
}

export type ExperimentType =
  | 'regression'
  | 'time_series_forecast'
  | 'anomaly_detection'
  | 'classification'
  | 'clustering';

export type ExperimentStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ============================================
// Dataset Types (Phase 3)
// ============================================

export type DatasetStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

export interface Dataset {
  id: string;
  projectId: string;
  userId?: string;
  name: string;
  originalFilename: string;
  storagePath?: string;
  mimeType: string;
  fileSizeBytes: number;
  rowCount: number | null;
  columnCount: number | null;
  status: DatasetStatus;
  errorMessage?: string | null;
  schemaJson?: DatasetSchema | null;
  createdAt: string;
  updatedAt: string;
}

export type DetectedColumnType =
  | 'integer'
  | 'float'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'string';

export interface DatasetColumnSchema {
  name: string;
  index: number;
  type: DetectedColumnType;
  nonNullCount: number;
  nullCount: number;
  distinctCount: number;
}

export interface DatasetSchema {
  columns: DatasetColumnSchema[];
}

export interface DatasetNumericStats {
  count: number;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  distinctCount: number;
}

export interface DatasetTopValue {
  value: string;
  count: number;
  frequency: number;
}

export interface DatasetColumnProfile extends DatasetColumnSchema {
  numericStats?: DatasetNumericStats;
  categoricalStats?: {
    count: number;
    distinctCount: number;
    topValues: DatasetTopValue[];
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

export interface DatasetPreview {
  datasetId: string;
  headers: string[];
  columnTypes: DetectedColumnType[];
  rows: string[][];
  totalRows: number;
  previewRowCount: number;
  limit: number;
  offset: number;
}

// ============================================
// Experiment Types (Phase 4)
// ============================================

export type ExperimentTaskType = 'regression' | 'classification';

export type RegressionModelType = 'linear_regression' | 'random_forest_regressor';

export type ClassificationModelType = 'logistic_regression' | 'random_forest_classifier';

export type ExperimentModelType = RegressionModelType | ClassificationModelType;

export interface Experiment {
  id: string;
  projectId: string;
  datasetId: string;
  userId?: string;
  name: string;
  taskType: ExperimentTaskType;
  modelType: ExperimentModelType;
  targetColumn: string;
  featureColumns: string[];
  config: {
    testSize: number;
    randomState: number;
  };
  status: ExperimentStatus;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface ExperimentWithResults extends Experiment {
  latestRun?: ModelRun | null;
}

export type ModelRunStatus = 'running' | 'completed' | 'failed';

export interface RegressionMetrics {
  mae: number;
  rmse: number;
  r2: number | null;
  trainSamples: number;
  testSamples: number;
}

export interface ClassificationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  averaging: string;
  trainSamples: number;
  testSamples: number;
  confusionMatrix: number[][];
  labels: string[];
}

export interface PredictionSamplePoint {
  actual: number | string;
  predicted: number | string;
}

export interface ModelRun {
  id: string;
  experimentId: string;
  status: ModelRunStatus;
  metrics?: RegressionMetrics | ClassificationMetrics | null;
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

// ============================================
// Analysis Types (Phase 5)
// ============================================

export type AnalysisType =
  | 'describe'
  | 'correlation'
  | 'covariance'
  | 'linear_algebra'
  | 'compare';

export type AnalysisEngine = 'julia' | 'python' | 'comparison';

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AnalysisRun {
  id: string;
  projectId: string;
  datasetId: string;
  userId?: string;
  analysisType: AnalysisType;
  engine: AnalysisEngine;
  config: {
    columns?: string[];
    missingPolicy?: 'pairwise' | 'listwise';
    matrix?: number[][];
  };
  status: AnalysisStatus;
  result?: AnalysisResult | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface AnalysisColumnStats {
  name: string;
  count: number;
  missing: number;
  mean: number | null;
  median: number | null;
  std: number | null;
  variance: number | null;
  min: number | null;
  max: number | null;
  q1: number | null;
  q3: number | null;
  distinct: number;
  warnings: string[];
}

export interface AnalysisMatrixResult {
  columns: string[];
  matrix: (number | null)[][];
  pairN: number[][];
  missingPolicy: string;
  method: string;
  warnings: string[];
}

export interface LinearAlgebraResult {
  rows: number;
  cols: number;
  rank: number;
  singularValues: (number | null)[];
  singularValuesTruncated: boolean;
  conditionNumber: number | null;
  determinant: number | null;
  eigenvalues: (number | null)[] | null;
  warnings: string[];
}

export interface ComparisonEntry {
  metric: string;
  column?: string;
  pair?: [string, string];
  python: number | null;
  julia: number | null;
  absoluteDifference: number | null;
  relativeDifference: number | null;
  tolerance: number;
  agrees: boolean;
  warning?: string;
}

export interface ComparisonResult {
  comparedAt: string;
  engineVersions: {
    julia?: string;
    python?: Record<string, string>;
  };
  entries: ComparisonEntry[];
  agreed: number;
  disagreed: number;
  warnings: string[];
}

export type AnalysisResult =
  | { kind: 'describe'; columns: AnalysisColumnStats[]; conventions: Record<string, string> }
  | ({ kind: 'correlation' } & AnalysisMatrixResult)
  | ({ kind: 'covariance' } & AnalysisMatrixResult)
  | ({ kind: 'linear_algebra' } & LinearAlgebraResult)
  | ({ kind: 'compare' } & ComparisonResult);

// ============================================
// Async Job Types (Phase 6)
// ============================================

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

export type TerminalJobStatus = 'completed' | 'failed' | 'cancelled';

export const TERMINAL_JOB_STATUSES: TerminalJobStatus[] = [
  'completed',
  'failed',
  'cancelled',
];

export function isTerminalJobStatus(status: JobStatus): boolean {
  return (TERMINAL_JOB_STATUSES as JobStatus[]).includes(status);
}

export interface JobParams {
  projectId?: string;
  datasetId?: string;
  experimentId?: string;
  analysisType?: string;
  columns?: string[];
  missingPolicy?: 'pairwise' | 'listwise';
  maxRows?: number;
  taskType?: string;
  modelType?: string;
  targetColumn?: string;
  featureColumns?: string[];
  testSize?: number;
  randomState?: number;
  name?: string;
}

export interface Job {
  id: string;
  userId: string;
  projectId?: string | null;
  datasetId?: string | null;
  jobType: JobType;
  status: JobStatus;
  params: JobParams;
  progress: number;
  stage?: string | null;
  result?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  attempts: number;
  maxAttempts: number;
  bullmqJobId?: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

// ============================================
// Auth Types
// ============================================

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}

// ============================================
// Environment Validation
// ============================================

export interface ValidatedEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  CORS_ORIGIN: string;
  DATABASE_URL: string | undefined;
  API_VERSION: string;
  SUPABASE_URL: string | undefined;
  SUPABASE_ANON_KEY: string | undefined;
  SUPABASE_SERVICE_ROLE_KEY: string | undefined;
  STORAGE_DRIVER: 'local' | 'supabase';
  STORAGE_BUCKET: string;
  MAX_UPLOAD_MB: number;
  ML_SERVICE_URL: string;
  ML_SERVICE_KEY: string | undefined;
  ML_TIMEOUT_MS: number;
  JULIA_SERVICE_URL: string;
  JULIA_SERVICE_KEY: string | undefined;
  JULIA_TIMEOUT_MS: number;
  REDIS_URL: string | undefined;
  WORKER_CONCURRENCY: number;
  JOB_MAX_ATTEMPTS: number;
  JOB_BACKOFF_MS: number;
}

export interface FrontendEnv {
  NEXT_PUBLIC_API_URL: string;
  NEXT_PUBLIC_APP_NAME: string;
  NEXT_PUBLIC_APP_VERSION: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
}

// ============================================
// Utility Types
// ============================================

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface Timestamped {
  createdAt: string;
  updatedAt: string;
}

export interface Identifiable {
  id: string;
}