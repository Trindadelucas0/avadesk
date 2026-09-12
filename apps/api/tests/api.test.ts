import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { pool, query } from "../src/lib/db.js";
import { env } from "../src/lib/env.js";
import { encryptSecret, hashToken } from "../src/lib/crypto-secret.js";
import { isSafePushHref, sanitizePushHref } from "../src/lib/push-href.js";
import { WEB_PUSH_SEND_OPTIONS } from "../src/lib/push.js";
import { assertSafeTestDatabaseUrl } from "../src/lib/test-database.js";
import { shouldReceiveLive } from "../src/lib/live.js";

assertSafeTestDatabaseUrl(env.databaseUrl);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = createApp();

async function canConnect(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

const postgresReady = await canConnect();

let adminCookie = "";
let managerCookie = "";
let clientCookie = "";
let clientBCookie = "";
let projectAId = "";
let projectBId = "";

async function resetFixture() {
  const passwordHash = await bcrypt.hash(env.seedPassword, 10);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      TRUNCATE TABLE
        email_outbox, audit_logs, notifications, document_versions, documents,
        files, ticket_attachments, ticket_messages, ticket_events, tickets, tasks, releases, project_credentials, project_env_vault, user_project_access,
        password_reset_tokens, push_subscriptions, updates, projects, users, clients
      RESTART IDENTITY CASCADE
    `);

    const cA = await client.query<{ id: string }>(
      `INSERT INTO clients (name, company) VALUES ('Acme Corporation', 'Acme Corporation') RETURNING id`
    );
    const cB = await client.query<{ id: string }>(
      `INSERT INTO clients (name, company) VALUES ('Northwind Logistics', 'Northwind Logistics') RETURNING id`
    );
    const clientA = cA.rows[0].id;
    const clientB = cB.rows[0].id;

    await client.query(
      `INSERT INTO users (email, password_hash, role, client_id, name, active)
       VALUES
        ('admin@acme.dev', $1, 'admin', NULL, 'Admin', TRUE),
        ('manager@acme.dev', $1, 'manager', NULL, 'Manager', TRUE),
        ('cliente@acme.com', $1, 'client', $2, 'Cliente A', TRUE),
        ('cliente.b@northwind.com', $1, 'client', $3, 'Cliente B', TRUE)`,
      [passwordHash, clientA, clientB]
    );

    const pA = await client.query<{ id: string }>(
      `INSERT INTO projects (client_id, name, status, progress_pct, system_url, access_user, access_password, updated_at)
       VALUES ($1, 'Acme Operations Platform', 'development', 72, 'https://ops.acme.example', 'acme.ops', 'secretA', NOW())
       RETURNING id`,
      [clientA]
    );
    const pB = await client.query<{ id: string }>(
      `INSERT INTO projects (client_id, name, status, progress_pct, system_url, access_user, access_password, updated_at)
       VALUES ($1, 'Northwind Dispatch Board', 'planejado', 10, 'https://dispatch.northwind.example', 'nw.dispatch', 'secretB', NOW())
       RETURNING id`,
      [clientB]
    );
    projectAId = pA.rows[0].id;
    projectBId = pB.rows[0].id;

    await client.query(
      `INSERT INTO project_credentials (project_id, system_url, access_user, password_ciphertext)
       VALUES ($1, 'https://ops.acme.example', 'acme.ops', $2),
              ($3, 'https://dispatch.northwind.example', 'nw.dispatch', $4)`,
      [projectAId, encryptSecret("secretA"), projectBId, encryptSecret("secretB")]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function cookieFrom(res: request.Response): string {
  const raw = res.headers["set-cookie"];
  if (!raw) return "";
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((c) => c.split(";")[0]).join("; ");
}

before(async () => {
  if (!postgresReady) {
    console.warn("[tests] PostgreSQL unavailable — integration tests skipped.");
    return;
  }

  const migrationsDir = path.resolve(__dirname, "../../../db/migrations");
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    try {
      await pool.query(sql);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/already exists/i.test(message)) throw err;
    }
  }

  await resetFixture();

  const adminLogin = await request(app)
    .post("/auth/login")
    .send({ email: "admin@acme.dev", password: env.seedPassword });
  assert.equal(adminLogin.status, 200);
  adminCookie = cookieFrom(adminLogin);

  const managerLogin = await request(app)
    .post("/auth/login")
    .send({ email: "manager@acme.dev", password: env.seedPassword });
  assert.equal(managerLogin.status, 200);
  managerCookie = cookieFrom(managerLogin);

  const clientLogin = await request(app)
    .post("/auth/login")
    .send({ email: "cliente@acme.com", password: env.seedPassword });
  assert.equal(clientLogin.status, 200);
  clientCookie = cookieFrom(clientLogin);

  const clientBLogin = await request(app)
    .post("/auth/login")
    .send({ email: "cliente.b@northwind.com", password: env.seedPassword });
  assert.equal(clientBLogin.status, 200);
  clientBCookie = cookieFrom(clientBLogin);
});

after(async () => {
  await pool.end();
});

describe("test database guard", () => {
  it("refuses the UI database name", () => {
    assert.throws(
      () => assertSafeTestDatabaseUrl("postgresql://postgres:postgres@localhost:5434/nexus"),
      /nexus_test/
    );
  });

  it("allows nexus_test", () => {
    assert.doesNotThrow(() =>
      assertSafeTestDatabaseUrl("postgresql://postgres:postgres@localhost:5434/nexus_test")
    );
  });
});

describe("API health", () => {
  it("GET /health", async () => {
    const res = await request(app).get("/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(typeof res.body.email, "boolean");
    assert.equal(typeof res.body.push, "boolean");
  });
});

describe("Auth", { skip: !postgresReady }, () => {
  it("rejects invalid credentials", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@acme.dev", password: "wrong-password" });
    assert.equal(res.status, 401);
  });

  it("returns current user with session cookie", async () => {
    const res = await request(app).get("/auth/me").set("Cookie", adminCookie);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, "admin");
  });

  it("logout endpoint succeeds", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "admin@acme.dev", password: env.seedPassword });
    const cookie = cookieFrom(login);
    const logout = await request(app).post("/auth/logout").set("Cookie", cookie);
    assert.equal(logout.status, 200);
    assert.equal(logout.body.ok, true);
  });
});

describe("Tenant isolation", { skip: !postgresReady }, () => {
  it("client only sees own projects", async () => {
    const res = await request(app).get("/projects/mine").set("Cookie", clientCookie);
    assert.equal(res.status, 200);
    assert.ok(res.body.projects.every((p: { id: string }) => p.id === projectAId));
    assert.ok(!res.body.projects.some((p: { id: string }) => p.id === projectBId));
    assert.ok(
      res.body.projects.every(
        (p: { access_password?: string }) => p.access_password === undefined
      )
    );
    assert.ok(!JSON.stringify(res.body).includes("secretA"));
  });

  it("client cannot fetch another tenant project by id", async () => {
    const res = await request(app).get(`/projects/${projectBId}`).set("Cookie", clientCookie);
    assert.equal(res.status, 404);
  });

  it("client B cannot list updates of project A", async () => {
    const res = await request(app)
      .get(`/updates/project/${projectAId}`)
      .set("Cookie", clientBCookie);
    assert.equal(res.status, 404);
  });

  it("client cannot access admin project list", async () => {
    const res = await request(app).get("/projects").set("Cookie", clientCookie);
    assert.equal(res.status, 403);
  });
});

describe("Updates", { skip: !postgresReady }, () => {
  it("admin creates update and bumps projects.updated_at", async () => {
    const before = await query<{ updated_at: Date }>(
      `SELECT updated_at FROM projects WHERE id = $1`,
      [projectAId]
    );
    const beforeAt = new Date(before.rows[0].updated_at).getTime();
    await new Promise((r) => setTimeout(r, 25));

    const res = await request(app)
      .post("/updates")
      .set("Cookie", adminCookie)
      .send({
        project_id: projectAId,
        content: "Integração de frete validada em homologação.",
        status: "em_andamento",
        visible_to_client: true,
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.update.visible_to_client, true);

    const after = await query<{ updated_at: Date }>(
      `SELECT updated_at FROM projects WHERE id = $1`,
      [projectAId]
    );
    const afterAt = new Date(after.rows[0].updated_at).getTime();
    assert.ok(afterAt >= beforeAt);
  });

  it("filters updates by visible_to_client for client role", async () => {
    await request(app)
      .post("/updates")
      .set("Cookie", adminCookie)
      .send({
        project_id: projectAId,
        content: "Nota interna: revisar taxa de câmbio.",
        status: "planejado",
        visible_to_client: false,
      });

    await request(app)
      .post("/updates")
      .set("Cookie", adminCookie)
      .send({
        project_id: projectAId,
        content: "Dashboard operacional liberado para o time Acme.",
        status: "concluido",
        visible_to_client: true,
      });

    const clientView = await request(app)
      .get(`/updates/project/${projectAId}`)
      .set("Cookie", clientCookie);
    assert.equal(clientView.status, 200);
    assert.ok(
      clientView.body.updates.every((u: { visible_to_client: boolean }) => u.visible_to_client === true)
    );
    assert.ok(
      !clientView.body.updates.some((u: { content: string }) => u.content.includes("Nota interna"))
    );

    const adminView = await request(app)
      .get(`/updates/project/${projectAId}`)
      .set("Cookie", adminCookie);
    assert.equal(adminView.status, 200);
    assert.ok(
      adminView.body.updates.some((u: { content: string }) => u.content.includes("Nota interna"))
    );
  });

  it("rejects create update from client", async () => {
    const res = await request(app)
      .post("/updates")
      .set("Cookie", clientCookie)
      .send({
        project_id: projectAId,
        content: "Tentativa não autorizada",
        status: "em_andamento",
        visible_to_client: true,
      });
    assert.equal(res.status, 403);
  });
});

describe("V2 authz and updates", { skip: !postgresReady }, () => {
  it("CLIENT A cannot read project B (404, no leak)", async () => {
    const res = await request(app).get(`/v2/projects/${projectBId}`).set("Cookie", clientCookie);
    assert.equal(res.status, 404);
    assert.equal(res.body.error?.code, "NOT_FOUND");
  });

  it("CLIENT list never includes accessPassword", async () => {
    const res = await request(app).get("/v2/projects").set("Cookie", clientCookie);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.projects));
    for (const p of res.body.projects) {
      assert.equal(p.accessPassword, "");
      assert.ok(!JSON.stringify(p).includes("secretA"));
    }
  });

  it("CLIENT B cannot reveal credentials of project A", async () => {
    const res = await request(app)
      .post(`/v2/projects/${projectAId}/credentials/reveal`)
      .set("Cookie", clientBCookie)
      .send({});
    assert.equal(res.status, 404);
  });

  it("CLIENT A can reveal own project password", async () => {
    const res = await request(app)
      .post(`/v2/projects/${projectAId}/credentials/reveal`)
      .set("Cookie", clientCookie)
      .send({});
    assert.equal(res.status, 200);
    assert.equal(res.body.accessPassword, "secretA");
  });

  it("idempotency key returns the same update", async () => {
    const key = "idem-test-1";
    const body = {
      projectId: projectAId,
      title: "Painel de pedidos",
      content: "Listagem de pedidos em homologação.",
      status: "em_andamento",
      visibleToClient: true,
    };
    const first = await request(app)
      .post("/v2/updates")
      .set("Cookie", adminCookie)
      .set("Idempotency-Key", key)
      .send(body);
    assert.equal(first.status, 201);
    const second = await request(app)
      .post("/v2/updates")
      .set("Cookie", adminCookie)
      .set("Idempotency-Key", key)
      .send(body);
    assert.equal(second.status, 200);
    assert.equal(second.body.idempotent, true);
    assert.equal(second.body.update.id, first.body.update.id);
  });

  it("POST update succeeds even if outbox/email fails afterwards", async () => {
    const res = await request(app)
      .post("/v2/updates")
      .set("Cookie", adminCookie)
      .set("Idempotency-Key", "idem-outbox-1")
      .send({
        projectId: projectAId,
        title: "E-mail depois",
        content: "Publicado mesmo se o e-mail atrasar.",
        status: "concluido",
        visibleToClient: true,
      });
    assert.equal(res.status, 201);
    const outbox = await query(`SELECT status FROM email_outbox WHERE related_update_id = $1`, [
      res.body.update.id,
    ]);
    assert.ok(outbox.rows.length >= 1);
  });

  it("password reset token is one-shot", async () => {
    const user = await query<{ id: string }>(`SELECT id FROM users WHERE email = 'cliente@acme.com'`);
    const token = "reset-token-once";
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [user.rows[0].id, hashToken(token)]
    );
    const first = await request(app)
      .post("/v2/auth/reset")
      .send({ token, password: "NovaSenha99" });
    assert.equal(first.status, 200);
    const second = await request(app)
      .post("/v2/auth/reset")
      .send({ token, password: "OutraSenha99" });
    assert.equal(second.status, 400);
  });

  it("password reset token expires after 1 hour", async () => {
    const user = await query<{ id: string; password_hash: string }>(
      `SELECT id, password_hash FROM users WHERE email = 'cliente@acme.com'`
    );
    const token = "reset-token-expired";
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() - INTERVAL '1 minute')`,
      [user.rows[0].id, hashToken(token)]
    );
    const res = await request(app)
      .post("/v2/auth/reset")
      .send({ token, password: "NovaSenhaExpirada99" });
    assert.equal(res.status, 400);
    const after = await query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE email = 'cliente@acme.com'`
    );
    assert.equal(after.rows[0].password_hash, user.rows[0].password_hash);
  });

  it("new forgot invalidates previous unused reset tokens", async () => {
    const user = await query<{ id: string }>(`SELECT id FROM users WHERE email = 'cliente@acme.com'`);
    const oldToken = "reset-token-old-link";
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [user.rows[0].id, hashToken(oldToken)]
    );
    const forgot = await request(app).post("/v2/auth/forgot").send({ email: "cliente@acme.com" });
    assert.equal(forgot.status, 200);
    const old = await request(app)
      .post("/v2/auth/reset")
      .send({ token: oldToken, password: "SenhaDoLinkAntigo99" });
    assert.equal(old.status, 400);
  });

  it("login uses generic error", async () => {
    const res = await request(app)
      .post("/v2/auth/login")
      .send({ email: "nobody@example.com", password: "wrong" });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.message, "Credenciais inválidas.");
  });
});

describe("V2 tickets", { skip: !postgresReady }, () => {
  it("CLIENT creates a bug ticket", async () => {
    const res = await request(app)
      .post("/v2/tickets")
      .set("Cookie", clientCookie)
      .send({
        projectId: projectAId,
        type: "bug",
        title: "Login trava no celular",
        fields: { problem: "A tela trava ao entrar.", where: "Login" },
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.ticket.type, "bug");
    assert.equal(res.body.ticket.stage, "fix");
    assert.equal(res.body.ticket.origin, "portal");
    assert.equal(res.body.ticket.fields.problem, "A tela trava ao entrar.");
  });

  it("rejects fields from another ticket type", async () => {
    const res = await request(app)
      .post("/v2/tickets")
      .set("Cookie", clientCookie)
      .send({
        projectId: projectAId,
        type: "bug",
        title: "Campos errados",
        fields: { what: "x", why: "y" },
      });
    assert.equal(res.status, 400);
  });

  it("CLIENT creates other ticket with custom name", async () => {
    const res = await request(app)
      .post("/v2/tickets")
      .set("Cookie", clientCookie)
      .send({
        projectId: projectAId,
        type: "other",
        title: "ignorado",
        fields: { customName: "Relatório de estoque", what: "Preciso do relatório mensal." },
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.ticket.type, "other");
    assert.equal(res.body.ticket.title, "Relatório de estoque");
    assert.equal(res.body.ticket.fields.customName, "Relatório de estoque");
    assert.equal(res.body.ticket.origin, "portal");
  });

  it("CLIENT cannot create feature ticket", async () => {
    const res = await request(app)
      .post("/v2/tickets")
      .set("Cookie", clientCookie)
      .send({
        projectId: projectAId,
        type: "feature",
        title: "Exportar PDF",
        fields: { whatUserDoes: "Exportar o relatório em PDF." },
      });
    assert.equal(res.status, 403);
  });

  it("CLIENT cannot change ticket type to feature", async () => {
    const created = await request(app)
      .post("/v2/tickets")
      .set("Cookie", clientCookie)
      .send({
        projectId: projectAId,
        type: "bug",
        title: "Login trava",
        fields: { problem: "Trava ao entrar.", where: "Login" },
      });
    assert.equal(created.status, 201);
    const res = await request(app)
      .patch(`/v2/tickets/${created.body.ticket.id}/content`)
      .set("Cookie", clientCookie)
      .send({
        type: "feature",
        title: "Exportar PDF",
        fields: { whatUserDoes: "Exportar o relatório em PDF." },
      });
    assert.equal(res.status, 403);
  });

  it("CLIENT B cannot read CLIENT A ticket", async () => {
    const created = await request(app)
      .post("/v2/tickets")
      .set("Cookie", clientCookie)
      .send({
        projectId: projectAId,
        type: "bug",
        title: "Isolamento",
        fields: { problem: "segredo", where: "Home" },
      });
    assert.equal(created.status, 201);
    const id = created.body.ticket.id;
    const res = await request(app).get(`/v2/tickets/${id}`).set("Cookie", clientBCookie);
    assert.equal(res.status, 404);
    const confirm = await request(app)
      .post(`/v2/tickets/${id}/confirm`)
      .set("Cookie", clientBCookie)
      .send({});
    assert.equal(confirm.status, 404);
  });

  it("staff downloads ticket PDF; CLIENT 404; other tenant 404; unauthenticated 401", async () => {
    const created = await request(app)
      .post("/v2/tickets")
      .set("Cookie", clientCookie)
      .send({
        projectId: projectAId,
        type: "bug",
        title: "PDF do chamado",
        fields: { problem: "A tela trava ao entrar.", where: "Login" },
      });
    assert.equal(created.status, 201);
    const id = created.body.ticket.id;

    const pdf = await request(app).get(`/v2/tickets/${id}/pdf`).set("Cookie", adminCookie);
    assert.equal(pdf.status, 200);
    assert.match(String(pdf.headers["content-type"]), /application\/pdf/);
    assert.match(String(pdf.headers["content-disposition"]), /attachment/);
    assert.match(String(pdf.headers["content-disposition"]), /chamado-/);
    const body = Buffer.isBuffer(pdf.body) ? pdf.body : Buffer.from(pdf.body);
    assert.ok(body.length > 80);
    assert.equal(body.subarray(0, 4).toString(), "%PDF");

    const owner = await request(app).get(`/v2/tickets/${id}/pdf`).set("Cookie", clientCookie);
    assert.equal(owner.status, 404);
    assert.notEqual(String(owner.headers["content-type"] ?? ""), "application/pdf");

    const other = await request(app).get(`/v2/tickets/${id}/pdf`).set("Cookie", clientBCookie);
    assert.equal(other.status, 404);

    const anon = await request(app).get(`/v2/tickets/${id}/pdf`);
    assert.equal(anon.status, 401);

    const bad = await request(app).get("/v2/tickets/not-a-uuid/pdf").set("Cookie", adminCookie);
    assert.equal(bad.status, 404);
  });

  it("staff advances stages; skip is 409; client confirms", async () => {
    const created = await request(app)
      .post("/v2/tickets")
      .set("Cookie", adminCookie)
      .send({
        projectId: projectAId,
        type: "feature",
        title: "Relato do cliente: exportar PDF",
        origin: "admin_report",
        fields: { whatUserDoes: "Exportar o relatório em PDF." },
      });
    assert.equal(created.status, 201);
    assert.equal(created.body.ticket.origin, "admin_report");
    const id = created.body.ticket.id;

    const skip = await request(app)
      .patch(`/v2/tickets/${id}`)
      .set("Cookie", adminCookie)
      .send({ stage: "resolved" });
    assert.equal(skip.status, 409);

    const earlyConfirm = await request(app)
      .post(`/v2/tickets/${id}/confirm`)
      .set("Cookie", clientCookie)
      .send({});
    assert.equal(earlyConfirm.status, 409);

    const toProd = await request(app)
      .patch(`/v2/tickets/${id}`)
      .set("Cookie", adminCookie)
      .send({ stage: "production" });
    assert.equal(toProd.status, 200);
    assert.equal(toProd.body.ticket.stage, "production");

    const toResolved = await request(app)
      .patch(`/v2/tickets/${id}`)
      .set("Cookie", adminCookie)
      .send({ stage: "resolved" });
    assert.equal(toResolved.status, 200);

    const staffConfirm = await request(app)
      .post(`/v2/tickets/${id}/confirm`)
      .set("Cookie", adminCookie)
      .send({});
    assert.equal(staffConfirm.status, 403);

    const confirm = await request(app)
      .post(`/v2/tickets/${id}/confirm`)
      .set("Cookie", clientCookie)
      .send({});
    assert.equal(confirm.status, 200);
    assert.equal(confirm.body.ticket.stage, "closed");
  });

  it("GET /v2/tickets defaults to open; closed requires a date range", async () => {
    const created = await request(app)
      .post("/v2/tickets")
      .set("Cookie", adminCookie)
      .send({
        projectId: projectAId,
        type: "bug",
        title: "Lista aberta vs arquivo",
        origin: "admin_report",
        fields: { problem: "Filtro de concluídos", where: "Chamados" },
      });
    assert.equal(created.status, 201);
    const openId = created.body.ticket.id;
    await request(app).patch(`/v2/tickets/${openId}`).set("Cookie", adminCookie).send({ stage: "production" });
    await request(app).patch(`/v2/tickets/${openId}`).set("Cookie", adminCookie).send({ stage: "resolved" });
    const confirm = await request(app)
      .post(`/v2/tickets/${openId}/confirm`)
      .set("Cookie", clientCookie)
      .send({});
    assert.equal(confirm.status, 200);

    const stillOpen = await request(app)
      .post("/v2/tickets")
      .set("Cookie", adminCookie)
      .send({
        projectId: projectAId,
        type: "bug",
        title: "Ainda em correção",
        origin: "admin_report",
        fields: { problem: "Não encerrar", where: "Home" },
      });
    assert.equal(stillOpen.status, 201);
    const openKeepId = stillOpen.body.ticket.id;

    const listed = await request(app).get("/v2/tickets").set("Cookie", clientCookie);
    assert.equal(listed.status, 200);
    const listedIds = listed.body.tickets.map((t: { id: string }) => t.id);
    assert.equal(listedIds.includes(openId), false);
    assert.equal(listedIds.includes(openKeepId), true);
    assert.equal(
      listed.body.tickets.every((t: { stage: string }) => t.stage !== "closed"),
      true
    );

    const missingDates = await request(app)
      .get("/v2/tickets?stage=closed")
      .set("Cookie", clientCookie);
    assert.equal(missingDates.status, 400);

    const inverted = await request(app)
      .get("/v2/tickets?stage=closed&from=2026-09-11&to=2026-09-01")
      .set("Cookie", clientCookie);
    assert.equal(inverted.status, 400);

    const tooWide = await request(app)
      .get("/v2/tickets?stage=closed&from=2025-01-01&to=2026-12-31")
      .set("Cookie", clientCookie);
    assert.equal(tooWide.status, 400);

    const confirmedAt = new Date(confirm.body.ticket.clientConfirmedAt as string);
    const from = new Date(confirmedAt.getTime() - 86_400_000).toISOString().slice(0, 10);
    const to = new Date(confirmedAt.getTime() + 86_400_000).toISOString().slice(0, 10);
    const archived = await request(app)
      .get(`/v2/tickets?stage=closed&from=${from}&to=${to}`)
      .set("Cookie", clientCookie);
    assert.equal(archived.status, 200);
    const archivedIds = archived.body.tickets.map((t: { id: string }) => t.id);
    assert.equal(archivedIds.includes(openId), true);
    assert.equal(archivedIds.includes(openKeepId), false);

    const otherTenant = await request(app)
      .get(`/v2/tickets?stage=closed&from=${from}&to=${to}`)
      .set("Cookie", clientBCookie);
    assert.equal(otherTenant.status, 200);
    assert.equal(
      otherTenant.body.tickets.some((t: { id: string }) => t.id === openId),
      false
    );

    const boot = await request(app).get("/v2/bootstrap").set("Cookie", clientCookie);
    assert.equal(boot.status, 200);
    assert.equal(
      boot.body.tickets.every((t: { stage: string }) => t.stage !== "closed"),
      true
    );
  });

  it("CLIENT can reopen a resolved ticket with a note", async () => {
    const created = await request(app)
      .post("/v2/tickets")
      .set("Cookie", adminCookie)
      .send({
        projectId: projectAId,
        type: "routine",
        title: "Rotina mensal",
        origin: "admin_report",
        fields: { routineName: "Fechamento", whatChanges: "Incluir totais." },
      });
    assert.equal(created.status, 201);
    const id = created.body.ticket.id;
    await request(app).patch(`/v2/tickets/${id}`).set("Cookie", adminCookie).send({ stage: "production" });
    await request(app).patch(`/v2/tickets/${id}`).set("Cookie", adminCookie).send({ stage: "resolved" });
    const missing = await request(app)
      .post(`/v2/tickets/${id}/reopen`)
      .set("Cookie", clientCookie)
      .send({ note: "" });
    assert.equal(missing.status, 400);
    const reopen = await request(app)
      .post(`/v2/tickets/${id}/reopen`)
      .set("Cookie", clientCookie)
      .send({ note: "Ainda falta o total por loja." });
    assert.equal(reopen.status, 200);
    assert.equal(reopen.body.ticket.stage, "fix");
  });

  it("rejects desiredDate on implementation tickets", async () => {
    const res = await request(app)
      .post("/v2/tickets")
      .set("Cookie", clientCookie)
      .send({
        projectId: projectAId,
        type: "implementation",
        title: "Exportar CSV",
        fields: { what: "Exportar CSV", why: "Conferência", desiredDate: "amanhã" },
      });
    assert.equal(res.status, 400);
  });

  it("CLIENT attaches a PNG; other tenant cannot download; SVG and PDF are rejected", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    ).toString("base64");
    const created = await request(app)
      .post("/v2/tickets")
      .set("Cookie", clientCookie)
      .send({
        projectId: projectAId,
        type: "bug",
        title: "Print do erro",
        fields: { problem: "Botão não responde.", where: "Home" },
      });
    assert.equal(created.status, 201);
    assert.deepEqual(created.body.ticket.attachments, []);
    const id = created.body.ticket.id;

    const attached = await request(app)
      .post(`/v2/tickets/${id}/attachments`)
      .set("Cookie", clientCookie)
      .send({ name: "erro.png", mime: "image/png", contentBase64: png });
    assert.equal(attached.status, 201);
    assert.equal(attached.body.ticket.attachments.length, 1);
    assert.equal(attached.body.ticket.attachments[0].mime, "image/png");
    const attId = attached.body.ticket.attachments[0].id;

    const download = await request(app)
      .get(`/v2/tickets/${id}/attachments/${attId}/download`)
      .set("Cookie", clientCookie);
    assert.equal(download.status, 200);
    assert.match(String(download.headers["content-type"]), /image\/png/);

    const other = await request(app)
      .get(`/v2/tickets/${id}/attachments/${attId}/download`)
      .set("Cookie", clientBCookie);
    assert.equal(other.status, 404);

    const otherPost = await request(app)
      .post(`/v2/tickets/${id}/attachments`)
      .set("Cookie", clientBCookie)
      .send({ name: "x.png", mime: "image/png", contentBase64: png });
    assert.equal(otherPost.status, 404);

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString("base64");
    const svgRes = await request(app)
      .post(`/v2/tickets/${id}/attachments`)
      .set("Cookie", clientCookie)
      .send({ name: "x.svg", mime: "image/svg+xml", contentBase64: svg });
    assert.equal(svgRes.status, 400);

    const pdf = Buffer.from("%PDF-1.4\n").toString("base64");
    const pdfRes = await request(app)
      .post(`/v2/tickets/${id}/attachments`)
      .set("Cookie", clientCookie)
      .send({ name: "doc.pdf", mime: "application/pdf", contentBase64: pdf });
    assert.equal(pdfRes.status, 400);
  });

  it("staff requests info; client replies; other tenant is 404; closed is 409", async () => {
    const created = await request(app)
      .post("/v2/tickets")
      .set("Cookie", clientCookie)
      .send({
        projectId: projectAId,
        type: "bug",
        title: "Precisa de print",
        fields: { problem: "Erro ao salvar.", where: "Cadastro" },
      });
    assert.equal(created.status, 201);
    const id = created.body.ticket.id;
    assert.equal(created.body.ticket.awaitingReplyFromUserId, null);
    assert.deepEqual(created.body.ticket.messages, []);

    const empty = await request(app)
      .post(`/v2/tickets/${id}/messages`)
      .set("Cookie", adminCookie)
      .send({ body: "   " });
    assert.equal(empty.status, 400);

    const meB = await request(app).get("/auth/me").set("Cookie", clientBCookie);
    assert.equal(meB.status, 200);
    const otherId = meB.body.user.id as string;

    const badWait = await request(app)
      .post(`/v2/tickets/${id}/messages`)
      .set("Cookie", adminCookie)
      .send({ body: "Manda o CNPJ.", waitForUserId: otherId });
    assert.equal(badWait.status, 400);

    const asked = await request(app)
      .post(`/v2/tickets/${id}/messages`)
      .set("Cookie", adminCookie)
      .send({ body: "Precisamos do print da tela." });
    assert.equal(asked.status, 201);
    assert.equal(asked.body.ticket.awaitingReplyFromName, "Cliente A");
    assert.ok(asked.body.ticket.awaitingReplyFromUserId);
    assert.equal(asked.body.ticket.messages.length, 1);
    assert.equal(asked.body.ticket.messages[0].kind, "request");
    assert.equal(asked.body.ticket.messages[0].body, "Precisamos do print da tela.");

    const cross = await request(app)
      .post(`/v2/tickets/${id}/messages`)
      .set("Cookie", clientBCookie)
      .send({ body: "não deveria" });
    assert.equal(cross.status, 404);

    const replied = await request(app)
      .post(`/v2/tickets/${id}/messages`)
      .set("Cookie", clientCookie)
      .send({ body: "Segue o print.", waitForUserId: otherId });
    assert.equal(replied.status, 201);
    assert.equal(replied.body.ticket.awaitingReplyFromUserId, null);
    assert.equal(replied.body.ticket.messages.at(-1).kind, "reply");
    assert.equal(replied.body.ticket.messages.at(-1).body, "Segue o print.");

    await request(app).patch(`/v2/tickets/${id}`).set("Cookie", adminCookie).send({ stage: "production" });
    await request(app).patch(`/v2/tickets/${id}`).set("Cookie", adminCookie).send({ stage: "resolved" });
    const confirm = await request(app)
      .post(`/v2/tickets/${id}/confirm`)
      .set("Cookie", clientCookie)
      .send({});
    assert.equal(confirm.status, 200);

    const closedMsg = await request(app)
      .post(`/v2/tickets/${id}/messages`)
      .set("Cookie", adminCookie)
      .send({ body: "ainda preciso?" });
    assert.equal(closedMsg.status, 409);
  });

  it("author can edit intact ticket content; others cannot", async () => {
    const created = await request(app)
      .post("/v2/tickets")
      .set("Cookie", clientCookie)
      .send({
        projectId: projectAId,
        type: "bug",
        title: "Login trava",
        fields: { problem: "Trava ao entrar.", where: "Login" },
      });
    assert.equal(created.status, 201);
    const id = created.body.ticket.id;

    const ok = await request(app)
      .patch(`/v2/tickets/${id}/content`)
      .set("Cookie", clientCookie)
      .send({
        type: "bug",
        title: "Login trava no celular",
        fields: { problem: "A tela trava ao entrar.", where: "Login" },
      });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.ticket.title, "Login trava no celular");
    assert.equal(ok.body.ticket.fields.problem, "A tela trava ao entrar.");
    assert.equal(ok.body.ticket.stage, "fix");

    const otherTenant = await request(app)
      .patch(`/v2/tickets/${id}/content`)
      .set("Cookie", clientBCookie)
      .send({
        type: "bug",
        title: "Tentativa",
        fields: { problem: "x", where: "y" },
      });
    assert.equal(otherTenant.status, 404);

    const staffNotAuthor = await request(app)
      .patch(`/v2/tickets/${id}/content`)
      .set("Cookie", adminCookie)
      .send({
        type: "bug",
        title: "Admin tenta",
        fields: { problem: "x", where: "y" },
      });
    assert.equal(staffNotAuthor.status, 403);

    const clientStage = await request(app)
      .patch(`/v2/tickets/${id}`)
      .set("Cookie", clientCookie)
      .send({ stage: "production" });
    assert.equal(clientStage.status, 403);
  });

  it("staff can edit own intact ticket; production and reopen lock content", async () => {
    const created = await request(app)
      .post("/v2/tickets")
      .set("Cookie", adminCookie)
      .send({
        projectId: projectAId,
        type: "feature",
        title: "Exportar PDF",
        origin: "admin_report",
        fields: { whatUserDoes: "Exportar o relatório." },
      });
    assert.equal(created.status, 201);
    const id = created.body.ticket.id;

    const ok = await request(app)
      .patch(`/v2/tickets/${id}/content`)
      .set("Cookie", adminCookie)
      .send({
        type: "feature",
        title: "Exportar PDF do mês",
        fields: { whatUserDoes: "Exportar o relatório em PDF." },
      });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.ticket.title, "Exportar PDF do mês");

    const toProd = await request(app)
      .patch(`/v2/tickets/${id}`)
      .set("Cookie", adminCookie)
      .send({ stage: "production" });
    assert.equal(toProd.status, 200);

    const afterMove = await request(app)
      .patch(`/v2/tickets/${id}/content`)
      .set("Cookie", adminCookie)
      .send({
        type: "feature",
        title: "Não deve gravar",
        fields: { whatUserDoes: "Mudança tarde demais." },
      });
    assert.equal(afterMove.status, 409);

    await request(app).patch(`/v2/tickets/${id}`).set("Cookie", adminCookie).send({ stage: "resolved" });
    await request(app)
      .post(`/v2/tickets/${id}/reopen`)
      .set("Cookie", clientCookie)
      .send({ note: "Ainda falta o filtro." });

    const afterReopen = await request(app)
      .patch(`/v2/tickets/${id}/content`)
      .set("Cookie", adminCookie)
      .send({
        type: "feature",
        title: "Depois de reabrir",
        fields: { whatUserDoes: "Não." },
      });
    assert.equal(afterReopen.status, 409);
  });
});

describe("Admin overview", { skip: !postgresReady }, () => {
  it("staff receives aggregated KPIs without credentials", async () => {
    const res = await request(app).get("/v2/admin/overview").set("Cookie", adminCookie);
    assert.equal(res.status, 200);
    assert.ok(typeof res.body.generatedAt === "string");
    assert.ok(typeof res.body.systems.total === "number");
    assert.ok(typeof res.body.systems.byStatus.development === "number");
    assert.ok(typeof res.body.tickets.open === "number");
    assert.ok(typeof res.body.tickets.byStage.fix === "number");
    assert.ok(typeof res.body.tasks.doing === "number");
    assert.ok(typeof res.body.updates.visibleLast7d === "number");
    assert.ok(typeof res.body.directory.clients === "number");
    const blob = JSON.stringify(res.body);
    assert.ok(!blob.includes("secretA"));
    assert.ok(!blob.includes("access_password"));
  });

  it("CLIENT cannot read admin overview", async () => {
    const res = await request(app).get("/v2/admin/overview").set("Cookie", clientCookie);
    assert.equal(res.status, 403);
    assert.equal(res.body.error?.code, "FORBIDDEN");
  });

  it("unauthenticated overview is 401", async () => {
    const res = await request(app).get("/v2/admin/overview");
    assert.equal(res.status, 401);
  });
});

describe("V2 files categories", { skip: !postgresReady }, () => {
  const sampleTxt = Buffer.from("arquivo de teste").toString("base64");

  function fileBody(extra: Record<string, unknown>) {
    return {
      projectId: projectAId,
      name: "proposta.txt",
      mime: "text/plain",
      contentBase64: sampleTxt,
      ...extra,
    };
  }

  it("admin creates a custom category from label", async () => {
    const res = await request(app)
      .post("/v2/files")
      .set("Cookie", adminCookie)
      .send(fileBody({ categoryLabel: "Proposta comercial" }));
    assert.equal(res.status, 201);
    assert.equal(res.body.file.category, "proposta_comercial");
    assert.equal(res.body.file.categoryLabel, "Proposta comercial");
  });

  it("rejects invalid category slug and reserved label", async () => {
    const script = await request(app)
      .post("/v2/files")
      .set("Cookie", adminCookie)
      .send(fileBody({ category: "<script>" }));
    assert.equal(script.status, 400);
    assert.equal(script.body.error?.code, "VALIDATION");

    const reserved = await request(app)
      .post("/v2/files")
      .set("Cookie", adminCookie)
      .send(fileBody({ categoryLabel: "Outro" }));
    assert.equal(reserved.status, 400);
  });

  it("legacy briefing category is read as outro", async () => {
    await query(
      `INSERT INTO files (project_id, original_name, stored_name, mime, category, size_bytes)
       VALUES ($1, 'brief.txt', 'pending-brief', 'text/plain', 'briefing', 4)`,
      [projectAId]
    );
    const list = await request(app).get("/v2/files").set("Cookie", adminCookie);
    assert.equal(list.status, 200);
    const brief = list.body.files.find((f: { name: string }) => f.name === "brief.txt");
    assert.ok(brief);
    assert.equal(brief.category, "outro");
    assert.equal(brief.categoryLabel, "Outros");
  });

  it("CLIENT cannot upload files", async () => {
    const res = await request(app)
      .post("/v2/files")
      .set("Cookie", clientCookie)
      .send(fileBody({ category: "contrato_documentacao" }));
    assert.equal(res.status, 403);
  });

  it("CLIENT B does not see tenant A files", async () => {
    const res = await request(app).get("/v2/files").set("Cookie", clientBCookie);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.files));
    assert.ok(res.body.files.every((f: { projectId: string }) => f.projectId !== projectAId));
  });
});

describe("V2 users patch", { skip: !postgresReady }, () => {
  it("CLIENT cannot patch users (403)", async () => {
    const user = await query<{ id: string }>(`SELECT id FROM users WHERE email = 'cliente@acme.com'`);
    const res = await request(app)
      .patch(`/v2/users/${user.rows[0].id}`)
      .set("Cookie", clientCookie)
      .send({ name: "Hack", role: "CLIENT", active: false });
    assert.equal(res.status, 403);
  });

  it("toggling CLIENT active keeps client_id (users_client_role_check)", async () => {
    const user = await query<{ id: string; client_id: string }>(
      `SELECT id, client_id FROM users WHERE email = 'cliente@acme.com'`
    );
    const res = await request(app)
      .patch(`/v2/users/${user.rows[0].id}`)
      .set("Cookie", adminCookie)
      .send({
        email: "cliente@acme.com",
        name: "Cliente A",
        role: "CLIENT",
        active: false,
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.clientId, user.rows[0].client_id);
    assert.equal(res.body.user.active, false);
    await request(app)
      .patch(`/v2/users/${user.rows[0].id}`)
      .set("Cookie", adminCookie)
      .send({ role: "CLIENT", active: true });
  });

  it("promoting CLIENT to MANAGER clears client_id instead of 500", async () => {
    const hash = await bcrypt.hash(env.seedPassword, 10);
    const company = await query<{ id: string }>(`SELECT id FROM clients ORDER BY name LIMIT 1`);
    const ins = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role, client_id, name, active)
       VALUES ('promo.manager@acme.com', $1, 'client', $2, 'Promo', TRUE)
       RETURNING id`,
      [hash, company.rows[0].id]
    );
    const res = await request(app)
      .patch(`/v2/users/${ins.rows[0].id}`)
      .set("Cookie", adminCookie)
      .send({
        email: "promo.manager@acme.com",
        name: "Promo",
        role: "MANAGER",
        clientId: null,
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, "MANAGER");
    assert.equal(res.body.user.clientId, null);
  });

  it("demoting staff to CLIENT without company returns 400", async () => {
    const hash = await bcrypt.hash(env.seedPassword, 10);
    const ins = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role, client_id, name, active)
       VALUES ('staff.demote@acme.com', $1, 'manager', NULL, 'Staff', TRUE)
       RETURNING id`,
      [hash]
    );
    const res = await request(app)
      .patch(`/v2/users/${ins.rows[0].id}`)
      .set("Cookie", adminCookie)
      .send({ role: "CLIENT", name: "Staff", email: "staff.demote@acme.com" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION");
  });
});

describe("V2 clients", { skip: !postgresReady }, () => {
  const payload = {
    name: "Maria Silva",
    contactEmail: "maria@loja.com",
    phone: "11987654321",
    whatsapp: "11987654321",
    company: "Loja Silva",
    segment: "Varejo",
    notes: "Cliente novo",
  };

  it("rejects create without contact email", async () => {
    const res = await request(app)
      .post("/v2/clients")
      .set("Cookie", adminCookie)
      .send({ name: "X", phone: "11987654321", whatsapp: "11987654321" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION");
  });

  it("CLIENT cannot create client", async () => {
    const res = await request(app).post("/v2/clients").set("Cookie", clientCookie).send(payload);
    assert.equal(res.status, 403);
  });

  it("admin creates client with required contact fields", async () => {
    const res = await request(app).post("/v2/clients").set("Cookie", adminCookie).send(payload);
    assert.equal(res.status, 201);
    assert.equal(res.body.client.contactEmail, "maria@loja.com");
    assert.equal(res.body.client.phone, "11987654321");
    assert.equal(res.body.client.whatsapp, "11987654321");
    assert.equal(res.body.client.primaryContact, "11987654321");
  });

  it("rejects invalid CNPJ", async () => {
    const res = await request(app)
      .post("/v2/clients")
      .set("Cookie", adminCookie)
      .send({ ...payload, contactEmail: "outra@loja.com", cnpj: "123" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION");
  });

  it("CLIENT can patch own company", async () => {
    const list = await request(app).get("/v2/clients").set("Cookie", clientCookie);
    assert.equal(list.status, 200);
    const id = list.body.clients[0].id;
    const res = await request(app)
      .patch(`/v2/clients/${id}`)
      .set("Cookie", clientCookie)
      .send({
        name: "Cliente A",
        contactEmail: "contato@acme.com",
        phone: "1133334444",
        whatsapp: "11999998888",
        company: "Acme Corporation",
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.client.contactEmail, "contato@acme.com");
    assert.equal(res.body.client.phone, "1133334444");
    assert.equal(res.body.client.company, "Acme Corporation");
  });

  it("CLIENT B cannot patch CLIENT A company", async () => {
    const list = await request(app).get("/v2/clients").set("Cookie", clientCookie);
    const id = list.body.clients[0].id;
    const res = await request(app)
      .patch(`/v2/clients/${id}`)
      .set("Cookie", clientBCookie)
      .send({
        name: "Hack",
        contactEmail: "hack@x.com",
        phone: "11987654321",
        whatsapp: "11987654321",
      });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });

  it("GET cnpj with short value is 400", async () => {
    const res = await request(app).get("/v2/clients/cnpj/123").set("Cookie", adminCookie);
    assert.equal(res.status, 400);
  });

  it("GET cnpj without session is 401", async () => {
    const res = await request(app).get("/v2/clients/cnpj/12345678000195");
    assert.equal(res.status, 401);
  });
});

describe("V2 users get, email and password", { skip: !postgresReady }, () => {
  it("GET user by id returns dto without hash; CLIENT 403; missing 404", async () => {
    const user = await query<{ id: string }>(`SELECT id FROM users WHERE email = 'admin@acme.dev'`);
    const ok = await request(app).get(`/v2/users/${user.rows[0].id}`).set("Cookie", adminCookie);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.email, "admin@acme.dev");
    assert.equal(ok.body.user.password_hash, undefined);
    assert.ok(!("passwordHash" in ok.body.user));

    const forbidden = await request(app)
      .get(`/v2/users/${user.rows[0].id}`)
      .set("Cookie", clientCookie);
    assert.equal(forbidden.status, 403);

    const missing = await request(app)
      .get("/v2/users/00000000-0000-4000-8000-000000000000")
      .set("Cookie", adminCookie);
    assert.equal(missing.status, 404);

    const bad = await request(app).get("/v2/users/not-a-uuid").set("Cookie", adminCookie);
    assert.equal(bad.status, 404);
  });

  it("PATCH persists unique email and rejects duplicate", async () => {
    const hash = await bcrypt.hash(env.seedPassword, 10);
    const company = await query<{ id: string }>(`SELECT id FROM clients ORDER BY name LIMIT 1`);
    const ins = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role, client_id, name, active)
       VALUES ('edit.email@acme.com', $1, 'client', $2, 'Edit Email', TRUE)
       RETURNING id`,
      [hash, company.rows[0].id]
    );
    const id = ins.rows[0].id;
    const ok = await request(app)
      .patch(`/v2/users/${id}`)
      .set("Cookie", adminCookie)
      .send({
        email: "edit.email.novo@acme.com",
        name: "Edit Email",
        role: "CLIENT",
        clientId: company.rows[0].id,
      });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.email, "edit.email.novo@acme.com");

    const dup = await request(app)
      .patch(`/v2/users/${id}`)
      .set("Cookie", adminCookie)
      .send({
        email: "admin@acme.dev",
        name: "Edit Email",
        role: "CLIENT",
        clientId: company.rows[0].id,
      });
    assert.equal(dup.status, 400);
    assert.equal(dup.body.error.code, "VALIDATION");
  });

  it("staff sets password; CLIENT 403; login uses the new password", async () => {
    const hash = await bcrypt.hash(env.seedPassword, 10);
    const company = await query<{ id: string }>(`SELECT id FROM clients ORDER BY name LIMIT 1`);
    const ins = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role, client_id, name, active)
       VALUES ('pwd.user@acme.com', $1, 'client', $2, 'Pwd User', TRUE)
       RETURNING id`,
      [hash, company.rows[0].id]
    );
    const id = ins.rows[0].id;

    const forbidden = await request(app)
      .post(`/v2/users/${id}/password`)
      .set("Cookie", clientCookie)
      .send({ password: "NovaSenha99" });
    assert.equal(forbidden.status, 403);

    const short = await request(app)
      .post(`/v2/users/${id}/password`)
      .set("Cookie", adminCookie)
      .send({ password: "short" });
    assert.equal(short.status, 400);

    const set = await request(app)
      .post(`/v2/users/${id}/password`)
      .set("Cookie", adminCookie)
      .send({ password: "NovaSenha99" });
    assert.equal(set.status, 200);
    assert.equal(set.body.user.email, "pwd.user@acme.com");
    assert.equal(set.body.user.password, undefined);
    assert.equal(set.body.password, undefined);

    const oldLogin = await request(app)
      .post("/v2/auth/login")
      .send({ email: "pwd.user@acme.com", password: env.seedPassword });
    assert.equal(oldLogin.status, 401);

    const newLogin = await request(app)
      .post("/v2/auth/login")
      .send({ email: "pwd.user@acme.com", password: "NovaSenha99" });
    assert.equal(newLogin.status, 200);

    const missing = await request(app)
      .post("/v2/users/00000000-0000-4000-8000-000000000000/password")
      .set("Cookie", adminCookie)
      .send({ password: "NovaSenha99" });
    assert.equal(missing.status, 404);
  });
});

describe("Live hub fanout", () => {
  it("staff receives other tenants; client only own tenant; actor excluded", () => {
    const staff = { userId: "admin", role: "admin", clientId: null };
    const clientA = { userId: "ca", role: "client", clientId: "tenant-a" };
    const clientB = { userId: "cb", role: "client", clientId: "tenant-b" };
    const actor = { userId: "actor", role: "admin", clientId: null };
    const event = { clientId: "tenant-a", actorId: "actor" };
    assert.equal(shouldReceiveLive(staff, event), true);
    assert.equal(shouldReceiveLive(clientA, event), true);
    assert.equal(shouldReceiveLive(clientB, event), false);
    assert.equal(shouldReceiveLive(actor, event), false);
    assert.equal(shouldReceiveLive(clientA, { clientId: "tenant-a", actorId: "ca" }), false);
    assert.equal(shouldReceiveLive(clientA, { clientId: null }), false);
  });
});

describe("Live hub HTTP", { skip: !postgresReady }, () => {
  it("GET /v2/events without session is 401", async () => {
    const res = await request(app).get("/v2/events");
    assert.equal(res.status, 401);
  });

  it("PATCH resolved queues email to the client login, not the other tenant", async () => {
    const created = await request(app)
      .post("/v2/tickets")
      .set("Cookie", clientCookie)
      .send({
        projectId: projectAId,
        type: "bug",
        title: "Email resolved",
        fields: { problem: "x", where: "Home" },
      });
    assert.equal(created.status, 201);
    const id = created.body.ticket.id;
    const prod = await request(app)
      .patch(`/v2/tickets/${id}`)
      .set("Cookie", adminCookie)
      .send({ stage: "production" });
    assert.equal(prod.status, 200);
    const toResolved = await request(app)
      .patch(`/v2/tickets/${id}`)
      .set("Cookie", adminCookie)
      .send({ stage: "resolved" });
    assert.equal(toResolved.status, 200);
    const outbox = await query<{ to_email: string }>(
      `SELECT to_email FROM email_outbox WHERE related_ticket_id = $1`,
      [id]
    );
    assert.ok(outbox.rows.some((r) => r.to_email === "cliente@acme.com"));
    assert.ok(!outbox.rows.some((r) => r.to_email === "cliente.b@northwind.com"));
  });
});

describe("Web Push send options", () => {
  it("uses high urgency so the phone can show the alert on the lock screen", () => {
    assert.equal(WEB_PUSH_SEND_OPTIONS.urgency, "high");
    assert.ok(WEB_PUSH_SEND_OPTIONS.TTL >= 60);
  });
});

describe("Push href", () => {
  it("accepts same-origin relative paths", () => {
    assert.equal(isSafePushHref("/client/updates"), true);
    assert.equal(isSafePushHref("/admin/chamados"), true);
    assert.equal(isSafePushHref("/client/chamados?stage=fix"), true);
  });

  it("rejects absolute and protocol-relative URLs", () => {
    assert.equal(isSafePushHref("https://evil.com"), false);
    assert.equal(isSafePushHref("//evil.com"), false);
    assert.equal(isSafePushHref("javascript:alert(1)"), false);
    assert.equal(sanitizePushHref("https://evil.com"), "/");
    assert.equal(sanitizePushHref("/admin/foo\nbar"), "/admin");
  });
});

describe("V2 notifications", { skip: !postgresReady }, () => {
  it("rejects an external href", async () => {
    const user = await query<{ id: string }>(`SELECT id FROM users WHERE email = 'cliente@acme.com'`);
    const res = await request(app)
      .post("/v2/notifications")
      .set("Cookie", adminCookie)
      .send({
        userId: user.rows[0].id,
        title: "Aviso",
        body: "Mensagem",
        href: "https://evil.com",
      });
    assert.equal(res.status, 400);
  });

  it("staff creates a relative-href notification", async () => {
    const user = await query<{ id: string }>(`SELECT id FROM users WHERE email = 'cliente@acme.com'`);
    const res = await request(app)
      .post("/v2/notifications")
      .set("Cookie", adminCookie)
      .send({
        userId: user.rows[0].id,
        title: "Atualização",
        body: "Veja a evolução",
        href: "/client/updates",
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.notification.href, "/client/updates");
    assert.equal(res.body.notification.title, "Atualização");
  });

  it("CLIENT cannot create notifications", async () => {
    const user = await query<{ id: string }>(`SELECT id FROM users WHERE email = 'cliente@acme.com'`);
    const res = await request(app)
      .post("/v2/notifications")
      .set("Cookie", clientCookie)
      .send({
        userId: user.rows[0].id,
        title: "Nope",
        body: "Nope",
        href: "/client",
      });
    assert.equal(res.status, 403);
  });
});

describe("V2 project credentials write", { skip: !postgresReady }, () => {
  it("staff can PATCH access credentials; list never returns password", async () => {
    const patch = await request(app)
      .patch(`/v2/projects/${projectAId}`)
      .set("Cookie", adminCookie)
      .send({
        clientId: (
          await query<{ client_id: string }>(`SELECT client_id FROM projects WHERE id = $1`, [projectAId])
        ).rows[0].client_id,
        name: "Acme Operations Platform",
        systemUrl: "https://ops.acme.example/app",
        accessUser: "acme.ops",
        accessPassword: "novaSenhaA",
      });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.project.accessPassword, "");
    assert.equal(patch.body.project.hasPassword, true);
    assert.equal(patch.body.project.systemUrl, "https://ops.acme.example/app");
    assert.ok(!JSON.stringify(patch.body).includes("novaSenhaA"));

    const list = await request(app).get("/v2/projects").set("Cookie", clientCookie);
    assert.equal(list.status, 200);
    const row = list.body.projects.find((p: { id: string }) => p.id === projectAId);
    assert.equal(row.accessPassword, "");
    assert.ok(!JSON.stringify(list.body).includes("novaSenhaA"));

    const reveal = await request(app)
      .post(`/v2/projects/${projectAId}/credentials/reveal`)
      .set("Cookie", clientCookie)
      .send({});
    assert.equal(reveal.status, 200);
    assert.equal(reveal.body.accessPassword, "novaSenhaA");
  });

  it("rejects javascript: system URL", async () => {
    const res = await request(app)
      .patch(`/v2/projects/${projectAId}`)
      .set("Cookie", adminCookie)
      .send({ systemUrl: "javascript:alert(1)" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error?.code, "VALIDATION");
  });
});

describe("V2 project env vault", { skip: !postgresReady }, () => {
  const sampleEnv = "DATABASE_URL=postgres://x\nAPI_KEY=secret-env-value";

  it("admin can save, list metadata, reveal and clear without leaking ciphertext", async () => {
    const put = await request(app)
      .put(`/v2/projects/${projectAId}/env/test`)
      .set("Cookie", adminCookie)
      .send({ content: sampleEnv });
    assert.equal(put.status, 200);
    assert.equal(put.body.environment, "test");
    assert.equal(put.body.hasContent, true);
    assert.ok(put.body.updatedAt);
    assert.equal(put.body.content, undefined);
    assert.ok(!JSON.stringify(put.body).includes("secret-env-value"));
    assert.ok(!JSON.stringify(put.body).includes("v1:"));

    const list = await request(app)
      .get(`/v2/projects/${projectAId}/env`)
      .set("Cookie", adminCookie);
    assert.equal(list.status, 200);
    const blob = JSON.stringify(list.body);
    assert.ok(!blob.includes("secret-env-value"));
    assert.ok(!blob.includes("v1:"));
    const testMeta = list.body.environments.find((e: { environment: string }) => e.environment === "test");
    const prodMeta = list.body.environments.find(
      (e: { environment: string }) => e.environment === "production"
    );
    assert.equal(testMeta.hasContent, true);
    assert.equal(prodMeta.hasContent, false);

    const stored = await query<{ ciphertext: string }>(
      `SELECT ciphertext FROM project_env_vault WHERE project_id = $1 AND environment = 'test'`,
      [projectAId]
    );
    assert.ok(stored.rows[0].ciphertext.startsWith("v1:"));
    assert.ok(!stored.rows[0].ciphertext.includes("secret-env-value"));

    const reveal = await request(app)
      .post(`/v2/projects/${projectAId}/env/test/reveal`)
      .set("Cookie", adminCookie)
      .send({});
    assert.equal(reveal.status, 200);
    assert.equal(reveal.body.content, sampleEnv);

    const audit = await query<{ action: string; meta: string | null }>(
      `SELECT action, meta FROM audit_logs WHERE entity_id = $1 AND action LIKE 'env_%' ORDER BY created_at DESC LIMIT 5`,
      [projectAId]
    );
    assert.ok(audit.rows.some((r) => r.action === "env_saved" && r.meta === "test"));
    assert.ok(audit.rows.some((r) => r.action === "env_revealed" && r.meta === "test"));
    assert.ok(!JSON.stringify(audit.rows).includes("secret-env-value"));

    const cleared = await request(app)
      .delete(`/v2/projects/${projectAId}/env/test`)
      .set("Cookie", adminCookie);
    assert.equal(cleared.status, 204);

    const after = await request(app)
      .get(`/v2/projects/${projectAId}/env`)
      .set("Cookie", adminCookie);
    const emptyTest = after.body.environments.find((e: { environment: string }) => e.environment === "test");
    assert.equal(emptyTest.hasContent, false);
  });

  it("manager and client get 403 on env vault", async () => {
    const managerGet = await request(app)
      .get(`/v2/projects/${projectAId}/env`)
      .set("Cookie", managerCookie);
    assert.equal(managerGet.status, 403);

    const managerPut = await request(app)
      .put(`/v2/projects/${projectAId}/env/production`)
      .set("Cookie", managerCookie)
      .send({ content: "SHOULD_NOT=save" });
    assert.equal(managerPut.status, 403);

    const clientGet = await request(app)
      .get(`/v2/projects/${projectAId}/env`)
      .set("Cookie", clientCookie);
    assert.equal(clientGet.status, 403);

    const clientPut = await request(app)
      .put(`/v2/projects/${projectAId}/env/test`)
      .set("Cookie", clientCookie)
      .send({ content: "HACK=1" });
    assert.equal(clientPut.status, 403);

    const clientReveal = await request(app)
      .post(`/v2/projects/${projectAId}/env/test/reveal`)
      .set("Cookie", clientCookie)
      .send({});
    assert.equal(clientReveal.status, 403);

    const stored = await query(
      `SELECT 1 FROM project_env_vault WHERE project_id = $1 AND ciphertext LIKE '%HACK%'`,
      [projectAId]
    );
    assert.equal(stored.rowCount, 0);
  });

  it("rejects invalid environment and oversized or empty content", async () => {
    const sqlish = await request(app)
      .put(`/v2/projects/${projectAId}/env/staging`)
      .set("Cookie", adminCookie)
      .send({ content: "X=1" });
    assert.equal(sqlish.status, 400);

    const empty = await request(app)
      .put(`/v2/projects/${projectAId}/env/production`)
      .set("Cookie", adminCookie)
      .send({ content: "   " });
    assert.equal(empty.status, 400);

    const tooBig = await request(app)
      .put(`/v2/projects/${projectAId}/env/production`)
      .set("Cookie", adminCookie)
      .send({ content: "A".repeat(65537) });
    assert.equal(tooBig.status, 400);
  });

  it("stores XSS payload as text and does not echo it on list", async () => {
    const payload = "<script>alert(1)</script>\nKEY=1";
    const put = await request(app)
      .put(`/v2/projects/${projectAId}/env/production`)
      .set("Cookie", adminCookie)
      .send({ content: payload });
    assert.equal(put.status, 200);
    assert.ok(!JSON.stringify(put.body).includes("<script>"));

    const list = await request(app)
      .get(`/v2/projects/${projectAId}/env`)
      .set("Cookie", adminCookie);
    assert.ok(!JSON.stringify(list.body).includes("<script>"));

    const reveal = await request(app)
      .post(`/v2/projects/${projectAId}/env/production/reveal`)
      .set("Cookie", adminCookie)
      .send({});
    assert.equal(reveal.status, 200);
    assert.equal(reveal.body.content, payload);
  });
});
