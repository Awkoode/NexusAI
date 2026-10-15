'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/AppShell';
import { EmptyState } from '@/components/EmptyState';
import { ProjectCard } from '@/components/ProjectCard';
import { ProjectForm } from '@/components/ProjectForm';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import * as api from '@/lib/api';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<api.Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<api.Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<api.Project | null>(null);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user, fetchProjects]);

  async function handleCreateProject(name: string, description?: string) {
    try {
      await api.createProject(name, description);
      await fetchProjects();
    } catch (err) {
      throw err;
    }
  }

  async function handleUpdateProject(id: string, name?: string, description?: string) {
    try {
      await api.updateProject(id, name, description);
      await fetchProjects();
    } catch (err) {
      throw err;
    }
  }

  async function handleDeleteProject() {
    if (!deletingProject) return;

    try {
      await api.deleteProject(deletingProject.id);
      setProjects((prev) => prev.filter((p) => p.id !== deletingProject.id));
      setDeletingProject(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
      setDeletingProject(null);
    }
  }

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" role="status" aria-label="Carregando" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50">Projetos</h1>
          <p className="text-surface-600 dark:text-surface-400 mt-1">
            Organize seus datasets, experimentos e modelos em projetos isolados.
          </p>
        </div>
        <button onClick={() => setIsFormOpen(true)} className="btn-primary">
          + Novo Projeto
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {projects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto criado"
          description="Comece criando seu primeiro projeto para organizar datasets, experimentos e modelos."
          actionLabel="Criar projeto"
          onAction={() => setIsFormOpen(true)}
          icon="📁"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={() => setEditingProject(project)}
              onDelete={() => setDeletingProject(project)}
            />
          ))}
        </div>
      )}

      {(isFormOpen || editingProject) && (
        <ProjectForm
          project={editingProject || undefined}
          onSubmit={editingProject ? handleUpdateProject : handleCreateProject}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingProject(null);
          }}
        />
      )}

      {deletingProject && (
        <DeleteConfirmModal
          projectName={deletingProject.name}
          onConfirm={handleDeleteProject}
          onCancel={() => setDeletingProject(null)}
        />
      )}
    </AppShell>
  );
}