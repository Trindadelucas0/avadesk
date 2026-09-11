/** Guard: integration tests must never target the UI database. */

export function databaseNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname.replace(/^\//, "").replace(/\/$/, "");
    return pathname.split("/")[0] ?? "";
  } catch {
    return "";
  }
}

export function quoteIdent(name: string): string {
  if (!/^[a-z][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Invalid database name: ${name}`);
  }
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Allow only names that contain "test" and are not the app DB (`nexus`).
 */
export function assertSafeTestDatabaseUrl(url: string): void {
  const name = databaseNameFromUrl(url).toLowerCase();
  if (!name) {
    throw new Error("DATABASE_URL_TEST inválida.");
  }
  if (name === "nexus" || name === "postgres" || name === "template0" || name === "template1") {
    throw new Error(
      `Recusando testes no banco "${name}". Use DATABASE_URL_TEST apontando para nexus_test (nunca o banco da UI).`
    );
  }
  if (!name.includes("test")) {
    throw new Error(
      `Recusando testes no banco "${name}". O nome precisa conter "test" (ex.: nexus_test).`
    );
  }
}
