import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env } from "./lib/env.js";
import { authRouter } from "./routes/auth.js";
import { projectsRouter } from "./routes/projects.js";
import { updatesRouter } from "./routes/updates.js";
import { hubRouter } from "./routes/hub.js";
import { v2Router } from "./v2/index.js";

export function createApp() {
  const app = express();
  // Next BFF forwards X-Forwarded-For; express-rate-limit requires this or it throws.
  app.set("trust proxy", 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: env.webOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "12mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      email: Boolean(env.resendApiKey),
      push: Boolean(env.vapidPublicKey && env.vapidPrivateKey),
    });
  });

  app.use("/auth", authRouter);
  app.use("/projects", projectsRouter);
  app.use("/updates", updatesRouter);
  app.use("/hub", hubRouter);
  app.use("/v2", v2Router);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Rota não encontrada." } });
  });

  return app;
}
