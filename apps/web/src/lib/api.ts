import { supabase } from "./supabase";

const BASE =
  ((import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:3001").replace(/\/$/, "") +
  "/api/v1";

export type Meta = { total?: number; page?: number; limit?: number; totalPages?: number; [k: string]: unknown };
export type Envelope<T> = { success: boolean; data: T; error?: unknown; meta?: Meta };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Keep error text short and free of stack traces / internals. */
export function sanitizeError(err: unknown): string {
  let msg = "";
  if (typeof err === "string") msg = err;
  else if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    msg = String(e.message ?? e.error ?? e.detail ?? "");
  }
  msg = msg.split("\n")[0].replace(/\s+at\s+.*$/, "").trim();
  if (!msg) msg = "Ocorreu um erro inesperado.";
  return msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
}

type Opts = { method?: string; body?: unknown; form?: FormData; auth?: boolean; signal?: AbortSignal };

export async function requestEnv<T>(path: string, opts: Opts = {}): Promise<{ data: T; meta?: Meta }> {
  const headers: Record<string, string> = {};
  if (opts.auth !== false) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(BASE + path, { method: opts.method ?? "GET", headers, body: body ?? null, signal: opts.signal ?? null });
  } catch {
    throw new ApiError("Não foi possível conectar à API. Verifique se o servidor está no ar.", 0);
  }
  let json: Envelope<T> | null = null;
  if (res.status !== 204) {
    try {
      json = (await res.json()) as Envelope<T>;
    } catch {
      json = null;
    }
  }
  if (!res.ok || (json && json.success === false)) {
    const fallback = res.status === 401 ? "Sessão expirada. Faça login novamente." : `Erro ${res.status}`;
    throw new ApiError(json?.error ? sanitizeError(json.error) : fallback, res.status);
  }
  return { data: (json?.data ?? (null as T)) as T, meta: json?.meta };
}

export async function request<T>(path: string, opts: Opts = {}): Promise<T> {
  return (await requestEnv<T>(path, opts)).data;
}

/* ---------- types (loose: backend may use camelCase or snake_case) ---------- */
type Loose = Record<string, unknown>;
export type Project = Loose & { id: string; name: string; description?: string | null };
export type Dataset = Loose & { id: string; name?: string; status?: string };
export type Experiment = Loose & { id: string; name?: string };
export type Run = Loose & { id: string; metrics?: Loose; status?: string };
export type Analysis = Loose & { id: string; analysisType?: string };
export type Job = Loose & { id: string; status: JobStatus; progress?: number; stage?: string };
export type JobStatus = "queued" | "active" | "completed" | "failed" | "cancelled";

export const TERMINAL: JobStatus[] = ["completed", "failed", "cancelled"];

export function pick<T = unknown>(obj: unknown, ...keys: string[]): T | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Loose;
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k] as T;
  return undefined;
}

export const createdAt = (o: unknown) => pick<string>(o, "createdAt", "created_at");

export function asList<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === "object") {
    const v = pick<unknown>(d, "items", "data", "results", "rows");
    if (Array.isArray(v)) return v as T[];
  }
  return [];
}

/* ---------- endpoints ---------- */
const q = (p: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => v !== undefined && v !== "" && s.set(k, String(v)));
  const str = s.toString();
  return str ? `?${str}` : "";
};

export const api = {
  health: () => request<unknown>("/health", { auth: false }),

  listProjects: () => request<unknown>("/projects").then(asList<Project>),
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  createProject: (b: { name: string; description: string }) =>
    request<Project>("/projects", { method: "POST", body: b }),
  updateProject: (id: string, b: { name: string; description: string }) =>
    request<Project>(`/projects/${id}`, { method: "PATCH", body: b }),
  deleteProject: (id: string) => request<unknown>(`/projects/${id}`, { method: "DELETE" }),

  uploadDataset: (projectId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Dataset>(`/projects/${projectId}/datasets`, { method: "POST", form });
  },
  listDatasets: (projectId: string) => request<unknown>(`/projects/${projectId}/datasets`).then(asList<Dataset>),
  getDataset: (id: string) => request<Dataset>(`/datasets/${id}`),
  previewDataset: (id: string, limit: number, offset: number) =>
    requestEnv<unknown>(`/datasets/${id}/preview${q({ limit, offset })}`),
  profileDataset: (id: string) => request<unknown>(`/datasets/${id}/profile`),
  deleteDataset: (id: string) => request<unknown>(`/datasets/${id}`, { method: "DELETE" }),

  createExperiment: (b: Loose) => request<Experiment>("/experiments", { method: "POST", body: b }),
  listExperiments: (projectId: string) =>
    request<unknown>(`/projects/${projectId}/experiments`).then(asList<Experiment>),
  getExperiment: (id: string) => request<Experiment>(`/experiments/${id}`),
  listRuns: (id: string) => request<unknown>(`/experiments/${id}/runs`).then(asList<Run>),
  runExperiment: (id: string) => request<unknown>(`/experiments/${id}/run`, { method: "POST" }),
  deleteExperiment: (id: string) => request<unknown>(`/experiments/${id}`, { method: "DELETE" }),

  createAnalysis: (projectId: string, b: Loose) =>
    request<Analysis>(`/projects/${projectId}/analyses`, { method: "POST", body: b }),
  listAnalyses: (projectId: string) =>
    request<unknown>(`/projects/${projectId}/analyses`).then(asList<Analysis>),
  getAnalysis: (id: string) => request<Analysis>(`/analyses/${id}`),
  deleteAnalysis: (id: string) => request<unknown>(`/analyses/${id}`, { method: "DELETE" }),

  createJob: (b: Loose) => request<Job>("/jobs", { method: "POST", body: b }),
  listJobs: (p: { page?: number; limit?: number; status?: string; jobType?: string; projectId?: string }) =>
    requestEnv<unknown>(`/jobs${q(p)}`).then((r) => ({ items: asList<Job>(r.data), meta: r.meta ?? (r.data as Meta) })),
  getJob: (id: string) => request<Job>(`/jobs/${id}`),
  cancelJob: (id: string) => request<unknown>(`/jobs/${id}/cancel`, { method: "POST" }),
};

/** Backoff polling interval for TanStack Query; stops on terminal status. */
export function jobPollInterval(status: string | undefined, updates: number): number | false {
  if (status && TERMINAL.includes(status as JobStatus)) return false;
  return Math.min(1000 * Math.pow(1.5, updates), 10000);
}

export function fmtDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function fmtNum(v: unknown, digits = 4) {
  if (typeof v !== "number" || !isFinite(v)) return v === null || v === undefined ? "—" : String(v);
  return Math.abs(v) >= 1000 ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : Number(v.toFixed(digits)).toString();
}
