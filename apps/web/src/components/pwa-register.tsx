"use client";

import { useEffect, useState } from "react";
import { Bell, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHubStore } from "@/stores/hub-store";
import {
  enableWebPushFromUserGesture,
  subscribeWebPushIfPermitted,
  type WebPushStatus,
} from "@/lib/web-push-subscribe";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type PushPrompt = Extract<WebPushStatus, "need-permission" | "need-install" | "denied">;

export function PwaRegister() {
  const session = useHubStore((s) => s.session);
  const hydrated = useHubStore((s) => s.hydrated);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [pushPrompt, setPushPrompt] = useState<PushPrompt | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          void reg.update();
        })
        .catch(() => {
          /* ignore SW errors in dev */
        });
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      const dismissed = document.cookie.split("; ").some((p) => p.startsWith("ch_pwa_dismiss="));
      if (!dismissed) setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  useEffect(() => {
    if (!hydrated || !session) return;
    let cancelled = false;
    void subscribeWebPushIfPermitted().then((status) => {
      if (cancelled) return;
      if (status === "need-permission" || status === "need-install" || status === "denied") {
        setPushPrompt(status);
        return;
      }
      setPushPrompt(null);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, session?.id]);

  const pushBanner =
    pushPrompt === "need-permission" ? (
      <>
        <p className="text-sm font-medium">Alertas na tela do celular</p>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          Toque em Ativar e aceite a permissão. Sem isso o aviso fica só no sino, não na tela
          bloqueada.
        </p>
      </>
    ) : pushPrompt === "need-install" ? (
      <>
        <p className="text-sm font-medium">Instale a Avadesk na tela inicial</p>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          No iPhone: Compartilhar → Adicionar à Tela de Início. Abra pelo ícone, entre e toque em
          Ativar alertas.
        </p>
      </>
    ) : pushPrompt === "denied" ? (
      <>
        <p className="text-sm font-medium">Alertas bloqueados neste aparelho</p>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          Em Ajustes do celular, permita notificações da Avadesk (ou do Chrome/Safari) e abra o app
          de novo.
        </p>
      </>
    ) : null;

  if (pushBanner && pushPrompt) {
    return (
      <div
        className="hub-dialog fixed bottom-20 left-4 right-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl p-4 md:bottom-6"
        role="dialog"
        aria-label="Alertas do celular"
      >
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" aria-hidden />
        <div className="flex-1">
          {pushBanner}
          <div className="mt-3 flex gap-2">
            {pushPrompt === "need-permission" ? (
              <Button
                size="sm"
                variant="accent"
                disabled={pushBusy}
                onClick={async () => {
                  setPushBusy(true);
                  const status = await enableWebPushFromUserGesture();
                  setPushBusy(false);
                  if (status === "ok") {
                    setPushPrompt(null);
                    return;
                  }
                  if (status === "need-permission" || status === "need-install" || status === "denied") {
                    setPushPrompt(status);
                  }
                }}
              >
                Ativar alertas
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setPushPrompt(null)}>
              Agora não
            </Button>
          </div>
        </div>
        <button
          type="button"
          className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hub-focus"
          aria-label="Fechar"
          onClick={() => setPushPrompt(null)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (!showInstall || !deferred) return null;

  return (
    <div
      className="hub-dialog fixed bottom-20 left-4 right-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl p-4 md:bottom-6"
      role="dialog"
      aria-label="Instalar Avadesk"
    >
      <Download className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" aria-hidden />
      <div className="flex-1">
        <p className="text-sm font-medium">Instale a Avadesk</p>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          Acesso rápido como app, com alertas no celular e shell offline básico.
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="accent"
            onClick={async () => {
              await deferred.prompt();
              setShowInstall(false);
              setDeferred(null);
            }}
          >
            Instalar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              document.cookie = "ch_pwa_dismiss=1; path=/; max-age=31536000; SameSite=Lax";
              setShowInstall(false);
            }}
          >
            Agora não
          </Button>
        </div>
      </div>
      <button
        type="button"
        className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hub-focus"
        aria-label="Fechar"
        onClick={() => setShowInstall(false)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function PushAlertsButton() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<WebPushStatus | null>(null);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="accent"
        className="w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const next = await enableWebPushFromUserGesture();
          setBusy(false);
          setStatus(next);
        }}
      >
        Ativar alertas na tela do celular
      </Button>
      {status === "ok" ? (
        <p className="text-xs text-[var(--text-secondary)]">Alertas ativados neste aparelho.</p>
      ) : null}
      {status === "need-install" ? (
        <p className="text-xs text-[var(--text-secondary)]">
          No iPhone, adicione à Tela de Início e abra pelo ícone antes de ativar.
        </p>
      ) : null}
      {status === "denied" ? (
        <p className="text-xs text-[var(--text-secondary)]">
          Permissão bloqueada. Libere notificações em Ajustes do celular.
        </p>
      ) : null}
      {status === "unavailable" || status === "unsupported" ? (
        <p className="text-xs text-[var(--text-secondary)]">
          Este navegador não recebe alerta na tela. Use o app instalado no Chrome (Android) ou o
          ícone da tela inicial (iPhone 16.4+).
        </p>
      ) : null}
    </div>
  );
}
