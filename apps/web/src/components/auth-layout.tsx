import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Hexagon, AlertTriangle } from "lucide-react";
import { supabaseConfigured } from "@/lib/supabase";

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main id="main" className="relative flex min-h-screen items-center justify-center bg-hero px-4 py-12">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-xl font-semibold">
          <Hexagon className="h-7 w-7 text-primary" aria-hidden /> NexusAI
        </Link>
        <div className="rounded-2xl border bg-card/90 p-8 shadow-2xl backdrop-blur">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          {!supabaseConfigured && (
            <p role="alert" className="mt-4 flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" /> VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não estão configuradas.
            </p>
          )}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </main>
  );
}

export function FormError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{msg}</p>;
}

export function friendlyAuthError(m: string) {
  const s = m.toLowerCase();
  if (s.includes("invalid login")) return "Email ou senha incorretos.";
  if (s.includes("email not confirmed")) return "Confirme seu email antes de entrar.";
  if (s.includes("already registered")) return "Este email já está cadastrado.";
  if (s.includes("password")) return "A senha não atende aos requisitos (mínimo 6 caracteres).";
  if (s.includes("fetch")) return "Não foi possível conectar ao serviço de autenticação.";
  return m;
}
