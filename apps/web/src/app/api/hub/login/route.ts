import { NextRequest, NextResponse } from "next/server";
import { POST as v2Post } from "../../v2/[...path]/route";

export const dynamic = "force-dynamic";

function apiOrigin() {
  return (
    process.env.API_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:4000"
  );
}

function setCookieList(res: Response): string[] {
  const typed = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typed.getSetCookie?.().length) return typed.getSetCookie();
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

/** Compat PWA antigo: espera `{ ok, payload }` e cookie de sessão. */
export async function POST(req: NextRequest) {
  const loginRes = await v2Post(req, { params: Promise.resolve({ path: ["auth", "login"] }) });
  if (!loginRes.ok) return loginRes;

  const setCookies = setCookieList(loginRes);
  const cookieHeader = setCookies.map((c) => c.split(";")[0]).join("; ");

  let payload: unknown = await loginRes
    .clone()
    .json()
    .catch(() => ({}));

  try {
    const boot = await fetch(`${apiOrigin()}/v2/bootstrap`, {
      headers: { cookie: cookieHeader, accept: "application/json" },
      cache: "no-store",
    });
    if (boot.ok) payload = await boot.json();
  } catch {
    /* login already succeeded */
  }

  const out = NextResponse.json({ ok: true, payload });
  for (const c of setCookies) out.headers.append("set-cookie", c);
  return out;
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
