'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api';

export interface DashboardData {
  projects: api.Project[];
  datasetCount: number;
  experimentCount: number;
  jobs: api.Job[];
  jobsTotal: number;
  recentAnalyses: (api.AnalysisRun & { projectName: string })[];
  recentExperiments: (api.Experiment & { projectName: string })[];
  failedSources: string[];
}

async function settled<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

/**
 * Aggregates real API data for the dashboard. Uses Promise.allSettled-style
 * fan-out over existing endpoints (no aggregate endpoint yet) and reports
 * which sources failed instead of failing the whole dashboard.
 */
export function useDashboardData(enabled: boolean) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const projects = await api.listProjects();
      const failedSources: string[] = [];

      const [datasetsPerProject, experimentsPerProject, analysesPerProject, jobsPage] =
        await Promise.all([
          Promise.all(projects.map((p) => settled(api.listDatasets(p.id)))),
          Promise.all(projects.map((p) => settled(api.listExperiments(p.id)))),
          Promise.all(projects.map((p) => settled(api.listAnalyses(p.id)))),
          settled(api.listJobs(1, 50)),
        ]);

      if (datasetsPerProject.some((d) => d === null)) failedSources.push('datasets');
      if (experimentsPerProject.some((e) => e === null)) failedSources.push('experiments');
      if (analysesPerProject.some((a) => a === null)) failedSources.push('analyses');
      if (jobsPage === null) failedSources.push('jobs');

      const projectName = new Map(projects.map((p) => [p.id, p.name]));
      const datasets = datasetsPerProject.flatMap((d) => d ?? []);
      const experiments = experimentsPerProject.flatMap((e) => e ?? []);
      const analyses = analysesPerProject.flatMap((a, i) =>
        (a ?? []).map((run) => ({
          ...run,
          projectName: projectName.get(projects[i]?.id ?? '') ?? '—',
        }))
      );

      const byDateDesc = <T extends { createdAt: string }>(a: T, b: T) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

      setData({
        projects,
        datasetCount: datasets.length,
        experimentCount: experiments.length,
        jobs: (jobsPage?.jobs ?? []).slice(0, 5),
        jobsTotal: jobsPage?.total ?? 0,
        recentAnalyses: [...analyses].sort(byDateDesc).slice(0, 5),
        recentExperiments: experiments
          .map((e) => ({ ...e, projectName: projectName.get(e.projectId) ?? '—' }))
          .sort(byDateDesc)
          .slice(0, 5),
        failedSources,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { data, loading, error, refresh };
}
