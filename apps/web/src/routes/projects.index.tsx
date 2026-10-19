import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FolderKanban, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, ErrorAlert, LoadingBlock, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, createdAt, fmtDate, pick, sanitizeError, type Project } from "@/lib/api";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: "Projetos — NexusAI" },
      { name: "description", content: "Gerencie seus projetos de dados e ML." },
      { property: "og:title", content: "Projetos — NexusAI" },
      { property: "og:description", content: "Gerencie seus projetos de dados e ML." },
    ],
  }),
  component: () => (
    <AppShell crumbs={[{ label: "Projetos" }]}>
      <Projects />
    </AppShell>
  ),
});

function Projects() {
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => { toast.success("Projeto excluído."); qc.invalidateQueries({ queryKey: ["projects"] }); setDeleting(null); },
    onError: (e) => toast.error(sanitizeError(e)),
  });

  const list = useMemo(() => {
    const s = search.toLowerCase();
    return (projects.data ?? []).filter((p) => !s || p.name.toLowerCase().includes(s) || (p.description ?? "").toLowerCase().includes(s));
  }, [projects.data, search]);

  return (
    <>
      <PageHeader title="Projetos" description="Organize datasets, análises e experimentos." actions={<Button onClick={() => setEditing("new")}><Plus className="mr-1 h-4 w-4" /> Novo projeto</Button>} />
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Buscar projetos" placeholder="Buscar projetos…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {projects.isPending ? <LoadingBlock rows={3} /> : projects.isError ? <ErrorAlert error={projects.error} onRetry={() => projects.refetch()} /> : list.length === 0 ? (
        <EmptyState icon={<FolderKanban className="h-6 w-6" />} title={search ? "Nenhum projeto encontrado" : "Nenhum projeto ainda"}
          description={search ? "Tente outro termo de busca." : "Crie seu primeiro projeto para enviar datasets."}
          action={!search && <Button onClick={() => setEditing("new")}><Plus className="mr-1 h-4 w-4" /> Criar projeto</Button>} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const counts = [
              ["datasets", pick<number>(p, "datasetCount", "datasets_count", "datasetsCount")],
              ["experimentos", pick<number>(p, "experimentCount", "experiments_count", "experimentsCount")],
              ["análises", pick<number>(p, "analysisCount", "analyses_count", "analysesCount")],
            ].filter(([, v]) => typeof v === "number");
            return (
              <li key={p.id} className="group flex flex-col rounded-xl border bg-card p-5 transition-colors hover:border-primary/50">
                <Link to="/projects/$projectId" params={{ projectId: p.id }} className="font-display text-lg font-semibold hover:text-primary">{p.name}</Link>
                <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{p.description || "Sem descrição."}</p>
                {counts.length > 0 && (
                  <div className="mt-3 flex gap-3 font-mono text-xs text-muted-foreground">
                    {counts.map(([k, v]) => <span key={k as string}><span className="text-foreground">{v as number}</span> {k}</span>)}
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">{fmtDate(createdAt(p))}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Editar ${p.name}`} onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Excluir ${p.name}`} onClick={() => setDeleting(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <ProjectDialog project={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!deleting} onOpenChange={(o: boolean) => !o && setDeleting(null)} title="Excluir projeto?"
        description={`"${deleting?.name}" e todos os seus dados serão removidos. Esta ação não pode ser desfeita.`}
        busy={del.isPending} onConfirm={() => deleting && del.mutate(deleting.id)} />
    </>
  );
}

export function ProjectDialog({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const m = useMutation({
    mutationFn: () => (project ? api.updateProject(project.id, { name, description }) : api.createProject({ name, description })),
    onSuccess: () => {
      toast.success(project ? "Projeto atualizado." : "Projeto criado.");
      qc.invalidateQueries({ queryKey: ["projects"] });
      if (project) qc.invalidateQueries({ queryKey: ["project", project.id] });
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{project ? "Editar projeto" : "Novo projeto"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
          {m.isError && <ErrorAlert error={m.error} title="Não foi possível salvar" />}
          <div className="space-y-2"><Label htmlFor="pname">Nome</Label><Input id="pname" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="pdesc">Descrição</Label><Textarea id="pdesc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={m.isPending || !name.trim()}>{m.isPending ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
