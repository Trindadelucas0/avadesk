const BRASIL_API_CNPJ = "https://brasilapi.com.br/api/cnpj/v1/";

export type CnpjLookupResult = {
  company: string;
  tradeName: string;
};

const cache = new Map<string, CnpjLookupResult | "missing">();

export async function lookupCnpj(digits: string): Promise<CnpjLookupResult | null> {
  const hit = cache.get(digits);
  if (hit === "missing") return null;
  if (hit) return hit;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${BRASIL_API_CNPJ}${digits}`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) {
      cache.set(digits, "missing");
      return null;
    }
    if (!res.ok) {
      throw new Error("cnpj_upstream");
    }
    const json = (await res.json()) as { razao_social?: unknown; nome_fantasia?: unknown };
    const out: CnpjLookupResult = {
      company: typeof json.razao_social === "string" ? json.razao_social.trim() : "",
      tradeName: typeof json.nome_fantasia === "string" ? json.nome_fantasia.trim() : "",
    };
    cache.set(digits, out);
    if (cache.size > 200) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}
