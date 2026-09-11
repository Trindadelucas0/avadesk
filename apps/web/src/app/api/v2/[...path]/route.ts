import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function apiOrigin() {
  return (
    process.env.API_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:4000"
  );
}

const HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "expect",
]);

function sessionCookieHeader(store: Awaited<ReturnType<typeof cookies>>): string {
  const parts: string[] = [];
  for (const name of ["avadesk_session", "nexus_session"]) {
    const v = store.get(name)?.value;
    if (v) parts.push(`${name}=${v}`);
  }
  return parts.join("; ");
}

function copyUpstreamHeaders(upstream: globalThis.Response): Headers {
  const outHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "set-cookie") return;
    if (HOP.has(k)) return;
    outHeaders.set(key, value);
  });
  return outHeaders;
}

async function proxy(req: NextRequest, path: string[]) {
  const url = new URL(req.url);
  const target = `${apiOrigin()}/v2/${path.join("/")}${url.search}`;
  const store = await cookies();
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  const cookie = sessionCookieHeader(store);
  if (cookie) headers.set("cookie", cookie);
  headers.delete("host");

  const method = req.method;
  const isSse = method === "GET" && path[0] === "events";
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? Buffer.from(await req.arrayBuffer()) : undefined;

  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-port");
  headers.delete("x-forwarded-proto");

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
      redirect: "manual",
    });
  } catch (err) {
    console.error("[bff] upstream failed", target, err);
    return NextResponse.json(
      { error: { code: "API_UNAVAILABLE", message: "Não foi possível conectar." } },
      { status: 503 }
    );
  }

  const outHeaders = copyUpstreamHeaders(upstream);

  if (isSse) {
    if (!outHeaders.has("content-type")) {
      outHeaders.set("Content-Type", "text/event-stream; charset=utf-8");
    }
    outHeaders.set("Cache-Control", "no-cache, no-transform");
    outHeaders.set("X-Accel-Buffering", "no");
    return new NextResponse(upstream.body, { status: upstream.status, headers: outHeaders });
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  const res = new NextResponse(buf, { status: upstream.status, headers: outHeaders });

  const getSetCookie = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
  const raw = getSetCookie?.length
    ? getSetCookie
    : upstream.headers.get("set-cookie")
      ? [upstream.headers.get("set-cookie") as string]
      : [];

  for (const c of raw) {
    res.headers.append("set-cookie", c);
  }

  return res;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}
