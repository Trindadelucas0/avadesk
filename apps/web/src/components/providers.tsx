"use client";

import { Suspense, useEffect } from "react";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/pwa-register";
import { PushNoticeHost } from "@/components/hub/push-notice-host";
import { startHubSync } from "@/lib/hub-sync";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    return startHubSync();
  }, []);

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <PushNoticeHost />
      </Suspense>
      <PwaRegister />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{ duration: 2800 }}
        closeButton
      />
    </>
  );
}
