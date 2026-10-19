import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Activity, FolderKanban, LayoutDashboard, LogOut, Menu, Hexagon, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { LoadingBlock } from "./states";

const NAV = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { to: "/projects", label: "Projetos", Icon: FolderKanban, exact: false },
  { to: "/jobs", label: "Execuções", Icon: Activity, exact: false },
] as const;

export type Crumb = { label: string; to?: string; params?: Record<string, string> };

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 px-2 font-display text-lg font-semibold">
      <Hexagon className="h-6 w-6 text-primary" aria-hidden /> NexusAI
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Brand />
      <nav aria-label="Principal" className="flex flex-col gap-1">
        {NAV.map(({ to, label, Icon, exact }) => (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            activeOptions={{ exact }}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:font-semibold data-[status=active]:text-sidebar-primary"
          >
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto border-t border-sidebar-border pt-4">
        <p className="truncate px-3 text-xs text-muted-foreground" title={user?.email ?? ""}>{user?.email}</p>
        <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={() => signOut()}>
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children, crumbs = [] }: { children: ReactNode; crumbs?: Crumb[] }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth/login" });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Pular para o conteúdo
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-sidebar-border bg-sidebar lg:block">
        <NavList />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <NavList onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </Button>
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex items-center gap-1 text-sm text-muted-foreground">
              {crumbs.map((c, i) => (
                <li key={i} className="flex min-w-0 items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />}
                  {c.to && i < crumbs.length - 1 ? (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    <Link to={c.to as any} params={c.params as any} className="truncate hover:text-foreground">{c.label}</Link>
                  ) : (
                    <span className="truncate text-foreground" aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {loading || !session ? <LoadingBlock rows={4} /> : children}
        </main>
      </div>
    </div>
  );
}
