"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CenterNotice } from "@/components/hub/center-notice";
import {
  PUSH_OPEN_MESSAGE,
  clearPushNoticePending,
  parsePushOpenId,
  parsePushOpenSearch,
  readPushNoticePending,
  stripPushOpenParams,
  writePushNoticePending,
  type PushOpenPayload,
} from "@/lib/push-open";
import { useHubStore } from "@/stores/hub-store";

export function PushNoticeHost() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [notice, setNotice] = useState<PushOpenPayload | null>(null);
  const hydrated = useHubStore((s) => s.hydrated);
  const session = useHubStore((s) => s.session);
  const notifications = useHubStore((s) => s.notifications);
  const markNotificationRead = useHubStore((s) => s.markNotificationRead);
  const markedRef = useRef<string | null>(null);

  const openNotice = useCallback((payload: PushOpenPayload) => {
    writePushNoticePending(payload);
    setNotice(payload);
  }, []);

  useEffect(() => {
    const parsed = parsePushOpenSearch(searchParams);
    if (!parsed) return;
    openNotice(parsed);
    const next = stripPushOpenParams(searchParams);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router, openNotice]);

  useEffect(() => {
    if (notice) return;
    const pending = readPushNoticePending();
    if (pending) setNotice(pending);
  }, [notice]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== PUSH_OPEN_MESSAGE) return;
      const title = typeof data.title === "string" && data.title.trim() ? data.title.slice(0, 200) : "Avadesk";
      const body =
        typeof data.body === "string" && data.body.trim() ? data.body.slice(0, 500) : "Nova atualização";
      const id = parsePushOpenId(data.id);
      openNotice({
        id,
        title,
        body,
      });
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [openNotice]);

  useEffect(() => {
    const id = notice?.id;
    if (!id || !hydrated || !session) return;
    if (markedRef.current === id) return;
    const mine = notifications.some((n) => n.id === id && n.userId === session.id);
    if (!mine) return;
    markedRef.current = id;
    void markNotificationRead(id).catch(() => {
      markedRef.current = null;
    });
  }, [notice, hydrated, session, notifications, markNotificationRead]);

  return (
    <CenterNotice
      open={Boolean(notice)}
      onClose={() => {
        clearPushNoticePending();
        setNotice(null);
      }}
      title={notice?.title ?? ""}
    >
      {notice?.body ? <p>{notice.body}</p> : null}
    </CenterNotice>
  );
}
