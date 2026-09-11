import { createApp } from "./app.js";
import { databaseTargetLabel, env } from "./lib/env.js";

const app = createApp();

app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port}`);
  console.log(`[api] CORS origin: ${env.webOrigin}`);
  console.log(`[api] database: ${databaseTargetLabel()}`);
});
