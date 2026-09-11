import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { subscribeLive } from "../lib/live.js";

export const v2EventsRouter = Router();

v2EventsRouter.get("/", requireAuth, (req, res) => {
  req.socket.setTimeout(0);
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const user = req.user!;
  const unsubscribe = subscribeLive({
    userId: user.id,
    role: user.role,
    clientId: user.client_id,
    res,
  });

  const onClose = () => {
    unsubscribe();
  };
  req.on("close", onClose);
  res.on("close", onClose);
});
