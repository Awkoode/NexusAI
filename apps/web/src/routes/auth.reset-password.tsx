import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout, FormError, friendlyAuthError } from "@/components/auth-layout";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — NexusAI" },
      { name: "description", content: "Defina uma nova senha para sua conta NexusAI." },
      { property: "og:title", content: "Nova senha — NexusAI" },
      { property: "og:description", content: "Defina uma nova senha para sua conta NexusAI." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return setErr("A senha precisa ter pelo menos 6 caracteres.");
    if (pw !== pw2) return setErr("As senhas não coincidem.");
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(friendlyAuthError(error.message));
    toast.success("Senha atualizada.");
    navigate({ to: "/" });
  }

  return (
    <AuthLayout title="Definir nova senha" footer={<Link to="/auth/login" className="text-primary hover:underline">Voltar ao login</Link>}>
      <form onSubmit={submit} className="space-y-4">
        <FormError msg={err} />
        <div className="space-y-2">
          <Label htmlFor="pw">Nova senha</Label>
          <Input id="pw" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw2">Confirmar senha</Label>
          <Input id="pw2" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Salvando…" : "Salvar senha"}</Button>
      </form>
    </AuthLayout>
  );
}
