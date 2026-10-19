import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Inbox, Loader2, RotateCw, XCircle, Ban, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sanitizeError } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ErrorAlert({ error, onRetry, title = "Não foi possível carregar" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center">
      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{sanitizeError(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="mr-1 h-4 w-4" /> Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center">
      <div className="mb-3 rounded-full bg-muted p-3 text-muted-foreground">{icon ?? <Inbox className="h-6 w-6" aria-hidden />}</div>
      <p className="font-display font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

const STATUS: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  queued: { label: "Na fila", cls: "border-muted-foreground/40 text-muted-foreground", Icon: CircleDashed },
  active: { label: "Executando", cls: "border-info/50 bg-info/10 text-info", Icon: Loader2 },
  running: { label: "Executando", cls: "border-info/50 bg-info/10 text-info", Icon: Loader2 },
  processing: { label: "Processando", cls: "border-info/50 bg-info/10 text-info", Icon: Loader2 },
  pending: { label: "Pendente", cls: "border-muted-foreground/40 text-muted-foreground", Icon: CircleDashed },
  uploaded: { label: "Enviado", cls: "border-warning/50 bg-warning/10 text-warning", Icon: Upload },
  completed: { label: "Concluído", cls: "border-success/50 bg-success/10 text-success", Icon: CheckCircle2 },
  ready: { label: "Pronto", cls: "border-success/50 bg-success/10 text-success", Icon: CheckCircle2 },
  failed: { label: "Falhou", cls: "border-destructive/50 bg-destructive/10 text-destructive", Icon: XCircle },
  cancelled: { label: "Cancelado", cls: "border-muted-foreground/40 text-muted-foreground", Icon: Ban },
};

export function StatusBadge({ status }: { status?: string }) {
  const s = STATUS[status ?? ""] ?? { label: status ?? "—", cls: "border-border text-muted-foreground", Icon: CircleDashed };
  const spin = status === "active" || status === "running" || status === "processing";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", s.cls)}>
      <s.Icon className={cn("h-3 w-3", spin && "animate-spin")} aria-hidden />
      {s.label}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon, hint }: { label: string; value: ReactNode; icon?: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2 font-mono text-3xl font-semibold">{value}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
