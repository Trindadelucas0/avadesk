"use client";

import { Suspense, useEffect } from "react";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/pwa-register";
import { PushNoticeHost } from "@/components/hub/push-notice-host";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { startHubSync } from "@/lib/hub-sync";

function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      toastOptions={{ duration: 2800 }}
      closeButton
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    return startHubSync();
  }, []);

  return (
    <ThemeProvider>
      {children}
      <Suspense fallback={null}>
        <PushNoticeHost />
      </Suspense>
      <PwaRegister />
      <ThemedToaster />
    </ThemeProvider>
  );
}
