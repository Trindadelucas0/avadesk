"use client";

import { useMemo, useState } from "react";
import { Bell, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NotificationItemRow } from "@/components/hub/cards";
import { Modal } from "@/components/hub/modal";
import { PageHeader } from "@/components/hub/page-header";
import { EmptyState } from "@/components/hub/states";
import { useHubStore } from "@/stores/hub-store";

export default function AdminNotificationsPage() {
  const notifications = useHubStore((s) => s.notifications);
  const users = useHubStore((s) => s.users);
  const markNotificationRead = useHubStore((s) => s.markNotificationRead);
  const createNotification = useHubStore((s) => s.createNotification);

  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [href, setHref] = useState("/client");

  const sorted = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [notifications]
  );

  const submit = async () => {
    if (!userId || !title.trim() || !body.trim()) {
      toast.error("Preencha usuário, título e mensagem.");
      return;
    }
    const user = users.find((u) => u.id === userId);
    await createNotification({
      userId,
      clientId: user?.clientId ?? null,
      title: title.trim(),
      body: body.trim(),
      href: href.trim() || "/client",
    });
    toast.success("Notificação enviada");
    setTitle("");
    setBody("");
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        icon={Bell}
        title="Notificações"
        description="Envio manual para usuários do hub."
        actions={
          <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Nova notificação
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          title="Nenhuma notificação"
          action={
            <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
              Criar notificação
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {sorted.map((n) => {
            const user = users.find((u) => u.id === n.userId);
            return (
              <li key={n.id}>
                <div className="mb-1 text-xs text-[var(--text-muted)]">
                  Para: {user?.name ?? n.userId ?? "—"}
                </div>
                <NotificationItemRow item={n} onRead={markNotificationRead} />
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={open} onOpenChange={setOpen} title="Nova notificação" description="Aparece no sino do destinatário.">
        <div className="space-y-4">
          <div>
            <Label htmlFor="n-user">Usuário</Label>
            <select
              id="n-user"
              className="mt-1.5 hub-control"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="n-title">Título</Label>
            <Input id="n-title" className="mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="n-body">Mensagem</Label>
            <Textarea id="n-body" className="mt-1.5" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="n-href">Link (href)</Label>
            <Input id="n-href" className="mt-1.5" value={href} onChange={(e) => setHref(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="accent" onClick={() => void submit()}>
              Enviar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
