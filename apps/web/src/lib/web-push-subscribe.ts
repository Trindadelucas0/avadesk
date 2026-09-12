import { v2 } from "@/lib/v2-client";

export const VAPID_STORAGE_KEY = "avadesk-vapid-public";

export type WebPushStatus =
  | "ok"
  | "need-permission"
  | "denied"
  | "need-install"
  | "unsupported"
  | "unavailable";

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || Boolean(nav.standalone);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function vapidApplicationServerKey(publicKey: string): ArrayBuffer {
  const bytes = urlBase64ToUint8Array(publicKey);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function secureEnough(): boolean {
  return window.isSecureContext || window.location.hostname === "localhost";
}

async function finishSubscribe(): Promise<WebPushStatus> {
  try {
    const vapid = await v2<{ publicKey: string }>("/push/vapid");
    const publicKey = vapid.publicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
    if (!publicKey) return "unavailable";
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    let prevKey = "";
    try {
      prevKey = localStorage.getItem(VAPID_STORAGE_KEY) || "";
    } catch {
      prevKey = "";
    }
    if (sub && prevKey && prevKey !== publicKey) {
      await sub.unsubscribe();
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidApplicationServerKey(publicKey),
      });
    }
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return "unavailable";
    await v2("/push/subscribe", {
      method: "POST",
      json: {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      },
    });
    try {
      localStorage.setItem(VAPID_STORAGE_KEY, publicKey);
    } catch {
      /* private mode */
    }
    return "ok";
  } catch {
    return "unavailable";
  }
}

function iosNeedsHomeScreen(): boolean {
  if (!isIosDevice()) return false;
  if (!isStandaloneDisplay()) return true;
  return !("PushManager" in window);
}

async function ensureServiceWorker(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    return true;
  } catch {
    return false;
  }
}

export async function subscribeWebPushIfPermitted(): Promise<WebPushStatus> {
  if (typeof window === "undefined") return "unavailable";
  if (!secureEnough()) return "unavailable";
  if (iosNeedsHomeScreen()) return "need-install";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "need-permission";
  return finishSubscribe();
}

export async function enableWebPushFromUserGesture(): Promise<WebPushStatus> {
  if (typeof window === "undefined") return "unavailable";
  if (!secureEnough()) return "unavailable";
  if (iosNeedsHomeScreen()) return "need-install";
  if (!pushSupported()) return "unsupported";
  if (!(await ensureServiceWorker())) return "unavailable";
  if (Notification.permission === "denied") return "denied";
  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") {
    return permission === "denied" ? "denied" : "need-permission";
  }
  return finishSubscribe();
}
