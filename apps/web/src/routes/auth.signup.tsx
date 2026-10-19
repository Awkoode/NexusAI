import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout, FormError, friendlyAuthError } from "@/components/auth-layout";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/signup")({
  head: () => ({
    meta: [
      { title: "Criar conta — NexusAI" },
      { name: "description", content: "Crie sua conta NexusAI e comece a analisar dados." },
      { property: "og:title", content: "Criar conta — NexusAI" },
      { property: "og:description", content: "Crie sua conta NexusAI e comece a analisar dados." },
    ],
  }),
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return setErr("A senha precisa ter pelo menos 6 caracteres.");
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, full_name: name }, emailRedirectTo: `${window.location.origin}/auth/login` },
    });
    setBusy(false);
    if (error) return setErr(friendlyAuthError(error.message));
    await supabase.auth.signOut();
    toast.success("Conta criada! Verifique seu email, se necessário, e faça login.");
    navigate({ to: "/auth/login" });
  }

  return (
    <AuthLayout title="Criar conta" subtitle="Comece a explorar seus dados." footer={<>Já tem conta? <Link to="/auth/login" className="text-primary hover:underline">Entrar</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <FormError msg={err} />
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Criando…" : "Criar conta"}</Button>
      </form>
    </AuthLayout>
  );
}
