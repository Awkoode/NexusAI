import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout, FormError, friendlyAuthError } from "@/components/auth-layout";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — NexusAI" },
      { name: "description", content: "Receba um link para redefinir sua senha NexusAI." },
      { property: "og:title", content: "Recuperar senha — NexusAI" },
      { property: "og:description", content: "Receba um link para redefinir sua senha NexusAI." },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset-password` });
    setBusy(false);
    if (error) return setErr(friendlyAuthError(error.message));
    setSent(true);
  }

  return (
    <AuthLayout title="Recuperar senha" subtitle="Enviaremos um link de redefinição." footer={<Link to="/auth/login" className="text-primary hover:underline">Voltar ao login</Link>}>
      {sent ? (
        <p role="status" className="rounded-md border border-success/40 bg-success/10 p-4 text-sm text-success">
          Se existir uma conta para {email}, você receberá um email com o link em instantes.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <FormError msg={err} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Enviando…" : "Enviar link"}</Button>
        </form>
      )}
    </AuthLayout>
  );
}
