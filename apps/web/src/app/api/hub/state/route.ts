import { NextRequest, NextResponse } from "next/server";
import { GET as v2Get } from "../../v2/[...path]/route";

export const dynamic = "force-dynamic";

/** Compat: shell antigo lê `{ payload }`. Não grava snapshot. */
export async function GET(req: NextRequest) {
  const bootRes = await v2Get(req, { params: Promise.resolve({ path: ["bootstrap"] }) });
  if (bootRes.status === 401) return bootRes;
  if (!bootRes.ok) return bootRes;
  const data = await bootRes.json();
  return NextResponse.json({
    payload: data,
    updatedAt: new Date().toISOString(),
  });
}

export async function PUT() {
  return NextResponse.json({ ok: true, ignored: true });
}

export async function POST() {
  return NextResponse.json({ ok: true, ignored: true });
}
