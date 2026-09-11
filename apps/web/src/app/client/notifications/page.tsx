"use client";

import { EmptyState, NotificationItemRow, PageHeader, PageSkeleton } from "@/components/hub";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientTenant } from "@/hooks/use-client-tenant";
import { useHubStore } from "@/stores/hub-store";

export default function ClientNotificationsPage() {
  const { hydrated, session, userNotifications } = useClientTenant();
  const markNotificationRead = useHubStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useHubStore((s) => s.markAllNotificationsRead);

  if (!hydrated) return <PageSkeleton />;

  const unread = userNotifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <PageHeader
        icon={Bell}
        title="Notificações"
        description="Alertas sobre updates, releases e movimentações nos seus projetos."
        actions={
          unread > 0 && session ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void markAllNotificationsRead(session.id)}
            >
              Marcar todas como lidas
            </Button>
          ) : null
        }
      />

      {userNotifications.length > 0 ? (
        <ul className="space-y-2">
          {userNotifications.map((item) => (
            <li key={item.id}>
              <NotificationItemRow item={item} onRead={markNotificationRead} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Caixa vazia"
          description="Você não tem notificações no momento."
        />
      )}
    </div>
  );
}
