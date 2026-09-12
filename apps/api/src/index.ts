import { createApp } from "./app.js";
import { databaseTargetLabel, env } from "./lib/env.js";

const app = createApp();

app.listen(env.port, env.host, () => {
  console.log(`[api] listening on http://${env.host}:${env.port}`);
  console.log(`[api] CORS origin: ${env.webOrigin}`);
  console.log(`[api] database: ${databaseTargetLabel()}`);
  if (!env.resendApiKey) {
    console.warn("[api] RESEND_API_KEY missing — e-mail stays in outbox (logged), not sent");
  }
  if (!env.vapidPublicKey || !env.vapidPrivateKey) {
    console.warn("[api] VAPID keys missing — Web Push disabled");
  }
});
