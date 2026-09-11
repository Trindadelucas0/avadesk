"use client";

import { useMemo } from "react";
import { useHubStore } from "@/stores/hub-store";
import { clientAccessibleProjects } from "@/lib/access";
import type { Project, UpdateItem } from "@/types";

function sortByDateDesc<T extends { createdAt?: string; releasedAt?: string; uploadedAt?: string }>(
  items: T[],
  key: "createdAt" | "releasedAt" | "uploadedAt" = "createdAt"
) {
  return [...items].sort(
    (a, b) =>
      new Date((b[key] as string) ?? 0).getTime() -
      new Date((a[key] as string) ?? 0).getTime()
  );
}

export function useClientTenant() {
  const hydrated = useHubStore((s) => s.hydrated);
  const session = useHubStore((s) => s.session);
  const projects = useHubStore((s) => s.projects);
  const updates = useHubStore((s) => s.updates);
  const releases = useHubStore((s) => s.releases);
  const documents = useHubStore((s) => s.documents);
  const files = useHubStore((s) => s.files);
  const notifications = useHubStore((s) => s.notifications);
  const clients = useHubStore((s) => s.clients);
  const allTasks = useHubStore((s) => s.tasks);
  const allTickets = useHubStore((s) => s.tickets);

  return useMemo(() => {
    const clientId = session?.clientId ?? null;
    const scoped = clientAccessibleProjects(session, projects);
    const clientProjects: Project[] = scoped;
    const projectIds = new Set(clientProjects.map((p) => p.id));
    const projectNames = Object.fromEntries(clientProjects.map((p) => [p.id, p.name]));

    const visibleUpdates: UpdateItem[] = sortByDateDesc(
      updates.filter((u) => projectIds.has(u.projectId) && u.visibleToClient)
    );

    const tenantReleases = sortByDateDesc(
      releases.filter((r) => projectIds.has(r.projectId)),
      "releasedAt"
    );

    const tenantDocuments = sortByDateDesc(
      documents.filter((d) => projectIds.has(d.projectId)),
      "uploadedAt"
    );

    const tenantFiles = sortByDateDesc(
      files.filter((f) => projectIds.has(f.projectId)),
      "uploadedAt"
    );

    const tasks = allTasks.filter((t) => projectIds.has(t.projectId));
    const tickets = sortByDateDesc(allTickets.filter((t) => projectIds.has(t.projectId)));

    const userNotifications = session
      ? sortByDateDesc(
          notifications.filter((n) => n.userId === session.id)
        )
      : [];

    const client = clientId ? clients.find((c) => c.id === clientId) : undefined;

    return {
      hydrated,
      session,
      client,
      clientProjects,
      projects: clientProjects,
      projectNames,
      visibleUpdates,
      tenantReleases,
      tenantDocuments,
      tenantFiles,
      tasks,
      tickets,
      userNotifications,
    };
  }, [
    hydrated,
    session,
    projects,
    updates,
    releases,
    documents,
    files,
    notifications,
    clients,
    allTasks,
    allTickets,
  ]);
}
