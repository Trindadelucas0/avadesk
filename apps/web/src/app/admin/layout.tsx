"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Building2,
  FileKey,
  FolderOpen,
  Home,
  KeyRound,
  LayoutGrid,
  Rocket,
  Settings,
  Ticket,
  Users,
} from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/hub/app-shell";
import { CommandMenu } from "@/components/hub/command-menu";
import { QuickUpdateModal } from "@/components/hub/quick-update-modal";
import { useHubStore } from "@/stores/hub-store";
import { PRODUCT_NAME } from "@/lib/brand";
import type { NavItem } from "@/components/hub/app-shell";

const mobileNav = [
  { href: "/admin", label: "Home", icon: Home },
  { href: "/admin/clients", label: "Empresas", icon: Building2 },
  { href: "/admin/projects", label: "Projetos", icon: LayoutGrid },
  { href: "/admin/users", label: "Usuários", icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const organizationName = useHubStore((s) => s.organizationName);
  const session = useHubStore((s) => s.session);

  const tickets = useHubStore((s) => s.tickets);
  const notifications = useHubStore((s) => s.notifications);
  const openTickets = tickets.filter((t) => t.stage !== "closed").length;
  const unread = session
    ? notifications.filter((n) => n.userId === session.id && !n.read).length
    : 0;

  const nav = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { href: "/admin", label: "Início", icon: Home },
      { href: "/admin/clients", label: "Clientes", icon: Building2 },
      { href: "/admin/projects", label: "Projetos", icon: LayoutGrid },
      { href: "/admin/access", label: "Acesso", icon: KeyRound },
    ];
    if (session?.role === "ADMIN") {
      items.push({ href: "/admin/environments", label: "Ambientes", icon: FileKey });
    }
    items.push(
      { href: "/admin/chamados", label: "Chamados", icon: Ticket, badge: openTickets || undefined },
      { href: "/admin/updates", label: "Updates", icon: Rocket },
      { href: "/admin/releases", label: "Releases", icon: Rocket },
      { href: "/admin/files", label: "Arquivos", icon: FolderOpen },
      { href: "/admin/notifications", label: "Notificações", icon: Bell, badge: unread || undefined },
      { href: "/admin/users", label: "Usuários", icon: Users },
      { href: "/admin/settings", label: "Configurações", icon: Settings }
    );
    return items;
  }, [session?.role, openTickets, unread]);

  return (
    <AuthGate allow={["ADMIN", "MANAGER"]}>
      <AppShell
        brand={organizationName || PRODUCT_NAME}
        nav={nav}
        mobileNav={mobileNav}
        onCommandOpen={() => setCmdOpen(true)}
        onQuickUpdate={() => setQuickOpen(true)}
        showQuickUpdate
      >
        {children}
      </AppShell>
      <CommandMenu
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        mode="admin"
        onQuickUpdate={() => setQuickOpen(true)}
      />
      <QuickUpdateModal open={quickOpen} onOpenChange={setQuickOpen} />
    </AuthGate>
  );
}
