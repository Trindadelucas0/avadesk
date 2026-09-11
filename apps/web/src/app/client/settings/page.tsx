"use client";

import { useRouter } from "next/navigation";
import { PageHeader, PageSkeleton } from "@/components/hub";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useClientTenant } from "@/hooks/use-client-tenant";
import { useHubStore } from "@/stores/hub-store";

export default function ClientSettingsPage() {
  const { hydrated } = useClientTenant();
  const logout = useHubStore((s) => s.logout);
  const prefs = useHubStore((s) => s.notificationPrefs);
  const setNotificationPrefs = useHubStore((s) => s.setNotificationPrefs);
  const router = useRouter();

  if (!hydrated) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-md space-y-6 animate-fade-in">
      <PageHeader
        icon={Settings}
        title="Configurações"
        description="Preferências do portal — gravadas no banco com o restante do Hub (sem envio real de e-mail)."
      />

      <section className="hub-surface space-y-4 p-5">
        <h2 className="text-sm font-medium">Notificações</h2>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="emailUpdates" className="text-sm font-normal text-[var(--text-secondary)]">
            E-mail quando houver update
          </Label>
          <Switch
            id="emailUpdates"
            checked={prefs.emailUpdates}
            onCheckedChange={(v) => setNotificationPrefs({ ...prefs, emailUpdates: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="emailReleases" className="text-sm font-normal text-[var(--text-secondary)]">
            E-mail em novas releases
          </Label>
          <Switch
            id="emailReleases"
            checked={prefs.emailReleases}
            onCheckedChange={(v) => setNotificationPrefs({ ...prefs, emailReleases: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="inAppOnly" className="text-sm font-normal text-[var(--text-secondary)]">
            Apenas in-app (silenciar e-mail)
          </Label>
          <Switch
            id="inAppOnly"
            checked={prefs.inAppOnly}
            onCheckedChange={(v) => setNotificationPrefs({ ...prefs, inAppOnly: v })}
          />
        </div>
      </section>

      <section className="hub-surface p-5 text-sm text-[var(--text-secondary)]">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Instalar como app (PWA)</h2>
        <p className="mt-2">
          No Chrome ou Edge, abra o menu do navegador e escolha &quot;Instalar aplicativo&quot; ou
          &quot;Adicionar à tela inicial&quot; para acesso rápido à Avadesk.
        </p>
      </section>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          void logout().then(() => router.replace("/login"));
        }}
      >
        Sair da conta
      </Button>
    </div>
  );
}
