export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

async function parse(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return res.json();
  }
  return null;
}

export async function v2<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`/api/v2${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const data = await parse(res);
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(
      res.status,
      err?.code || "ERROR",
      err?.message || "Não foi possível concluir a operação."
    );
  }
  return data as T;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `idemp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
