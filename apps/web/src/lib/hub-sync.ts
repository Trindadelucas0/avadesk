"use client";

import { toast } from "sonner";
import { useHubStore } from "@/stores/hub-store";

const POLL_MS = 30_000;
const DEBOUNCE_MS = 300;
const TOAST_GAP_MS = 5_000;
const BACKOFF = [1_000, 2_000, 5_000, 15_000];

const LIVE_REASONS = new Set(["ticket", "update", "file", "project"]);

function parseLiveEvent(raw: string): { type: string; reason: string } | null {
  try {
    const data = JSON.parse(raw) as { type?: unknown; reason?: unknown };
    if (data.type !== "hub.changed") return null;
    if (typeof data.reason !== "string" || !LIVE_REASONS.has(data.reason)) return null;
    return { type: data.type, reason: data.reason };
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string) {
  return useHubStore.getState().login(email, password);
}

export function startHubSync() {
  void useHubStore.getState().hydrate();

  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let backoffIndex = 0;
  let lastTicketToast = 0;
  let stopped = false;

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const closeSse = () => {
    clearReconnect();
    if (es) {
      es.onmessage = null;
      es.onerror = null;
      es.close();
      es = null;
    }
  };

  const scheduleRefresh = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (!useHubStore.getState().session) return;
      void useHubStore.getState().refresh();
    }, DEBOUNCE_MS);
  };

  const maybeToast = (reason: string) => {
    if (reason !== "ticket") return;
    if (typeof window === "undefined") return;
    if (!window.location.pathname.startsWith("/client")) return;
    const now = Date.now();
    if (now - lastTicketToast < TOAST_GAP_MS) return;
    lastTicketToast = now;
    toast("Chamado atualizado");
  };

  const connectSse = () => {
    if (stopped || typeof EventSource === "undefined") return;
    if (!useHubStore.getState().session) return;
    closeSse();
    const source = new EventSource("/api/v2/events");
    es = source;
    source.onmessage = (ev) => {
      backoffIndex = 0;
      const parsed = parseLiveEvent(ev.data);
      if (!parsed) return;
      scheduleRefresh();
      maybeToast(parsed.reason);
    };
    source.onerror = () => {
      source.close();
      if (es === source) es = null;
      if (stopped || !useHubStore.getState().session) return;
      const wait = BACKOFF[Math.min(backoffIndex, BACKOFF.length - 1)];
      backoffIndex += 1;
      clearReconnect();
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectSse();
      }, wait);
    };
  };

  const unsubSession = useHubStore.subscribe((state, prev) => {
    if (state.session && !prev.session) {
      backoffIndex = 0;
      connectSse();
    }
    if (!state.session && prev.session) {
      closeSse();
    }
  });

  if (useHubStore.getState().session) connectSse();

  const interval = setInterval(() => {
    if (!useHubStore.getState().session) return;
    void useHubStore.getState().refresh();
  }, POLL_MS);

  return () => {
    stopped = true;
    unsubSession();
    closeSse();
    if (debounceTimer) clearTimeout(debounceTimer);
    clearInterval(interval);
  };
}
