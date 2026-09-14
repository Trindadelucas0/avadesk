import { Router } from "express";
import { v2AuthRouter } from "./auth.js";
import { v2ProjectsRouter, v2UpdatesRouter } from "./projects-updates.js";
import { v2ProjectEnvRouter } from "./project-env.js";
import {
  v2BootstrapRouter,
  v2ClientsRouter,
  v2DocumentsRouter,
  v2FilesRouter,
  v2MeRouter,
  v2NotificationsRouter,
  v2ReleasesRouter,
  v2SettingsRouter,
  v2TasksRouter,
  v2UsersRouter,
} from "./rest.js";
import { v2TicketsRouter } from "./tickets.js";
import { v2PushRouter } from "./push.js";
import { v2AdminOverviewRouter } from "./overview.js";
import { v2EventsRouter } from "./events.js";

export const v2Router = Router();

v2Router.use("/auth", v2AuthRouter);
v2Router.use("/me", v2MeRouter);
v2Router.use("/bootstrap", v2BootstrapRouter);
v2Router.use("/events", v2EventsRouter);
v2Router.use("/admin/overview", v2AdminOverviewRouter);
v2Router.use("/projects", v2ProjectEnvRouter);
v2Router.use("/projects", v2ProjectsRouter);
v2Router.use("/updates", v2UpdatesRouter);
v2Router.use("/clients", v2ClientsRouter);
v2Router.use("/users", v2UsersRouter);
v2Router.use("/tasks", v2TasksRouter);
v2Router.use("/tickets", v2TicketsRouter);
v2Router.use("/push", v2PushRouter);
v2Router.use("/notifications", v2NotificationsRouter);
v2Router.use("/releases", v2ReleasesRouter);
v2Router.use("/documents", v2DocumentsRouter);
v2Router.use("/files", v2FilesRouter);
v2Router.use("/settings", v2SettingsRouter);
