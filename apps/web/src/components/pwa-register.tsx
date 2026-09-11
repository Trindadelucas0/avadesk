"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { v2 } from "@/lib/v2-client";
import { useHubStore } from "@/stores/hub-store";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function subscribeWebPush(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return;
  }
  if (!window.isSecureContext && window.location.hostname !== "localhost") return;
  try {
    const vapid = await v2<{ publicKey: string }>("/push/vapid");
    const publicKey = vapid.publicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
    if (!publicKey) return;
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== "granted") return;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
    await v2("/push/subscribe", {
      method: "POST",
      json: {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      },
    });
  } catch {
    /* permission denied or unsupported */
  }
}

export function PwaRegister() {
  const session = useHubStore((s) => s.session);
  const hydrated = useHubStore((s) => s.hydrated);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore SW errors in dev */
      });
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      const dismissed = document.cookie.split("; ").some((p) => p.startsWith("ch_pwa_dismiss="));
      if (!dismissed) setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  useEffect(() => {
    if (!hydrated || !session) return;
    void subscribeWebPush();
  }, [hydrated, session?.id]);

  if (!show || !deferred) return null;

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
              setShow(false);
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
              setShow(false);
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
        onClick={() => setShow(false)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
