import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout, FormError, friendlyAuthError } from "@/components/auth-layout";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/login")({
  head: () => ({
    meta: [
      { title: "Entrar — NexusAI" },
      { name: "description", content: "Acesse sua conta NexusAI." },
      { property: "og:title", content: "Entrar — NexusAI" },
      { property: "og:description", content: "Acesse sua conta NexusAI." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setErr(friendlyAuthError(error.message));
    navigate({ to: "/" });
  }

  return (
    <AuthLayout title="Entrar" subtitle="Bem-vindo de volta." footer={<>Não tem conta? <Link to="/auth/signup" className="text-primary hover:underline">Cadastre-se</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <FormError msg={err} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link to="/auth/forgot-password" className="text-xs text-muted-foreground hover:text-primary">Esqueceu a senha?</Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</Button>
      </form>
    </AuthLayout>
  );
}
