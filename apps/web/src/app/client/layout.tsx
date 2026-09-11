"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  FolderOpen,
  Home,
  KeyRound,
  LayoutGrid,
  Rocket,
  Settings,
  Ticket,
  User,
} from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/hub/app-shell";
import { CommandMenu } from "@/components/hub/command-menu";
import { PageSkeleton } from "@/components/hub/states";
import { useHubStore } from "@/stores/hub-store";
import { PRODUCT_NAME } from "@/lib/brand";

const nav = [
  { href: "/client", label: "Início", icon: Home },
  { href: "/client/updates", label: "Evolução", icon: Rocket },
  { href: "/client/access", label: "Acesso", icon: KeyRound },
  { href: "/client/projects", label: "Projetos", icon: LayoutGrid },
  { href: "/client/chamados", label: "Chamados", icon: Ticket },
  { href: "/client/releases", label: "Releases", icon: Rocket },
  { href: "/client/files", label: "Arquivos", icon: FolderOpen },
  { href: "/client/notifications", label: "Notificações", icon: Bell },
  { href: "/client/profile", label: "Perfil", icon: User },
  { href: "/client/settings", label: "Configurações", icon: Settings },
];

const mobileNav = [
  { href: "/client", label: "Início", icon: Home },
  { href: "/client/updates", label: "Evolução", icon: Rocket },
  { href: "/client/access", label: "Acesso", icon: KeyRound },
];

function ClientShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useHubStore((s) => s.session);
  const users = useHubStore((s) => s.users);
  const organizationName = useHubStore((s) => s.organizationName);
  const [cmdOpen, setCmdOpen] = useState(false);

  const user = users.find((u) => u.id === session?.id);
  const mustComplete = Boolean(user?.mustCompleteProfile);
  const onOnboarding = pathname === "/client/onboarding";
  const tickets = useHubStore((s) => s.tickets);
  const notifications = useHubStore((s) => s.notifications);
  const openTickets = tickets.filter((t) => t.stage !== "closed").length;
  const unread = session
    ? notifications.filter((n) => n.userId === session.id && !n.read).length
    : 0;
  const navItems = nav.map((item) => {
    if (item.href === "/client/chamados") return { ...item, badge: openTickets || undefined };
    if (item.href === "/client/notifications") return { ...item, badge: unread || undefined };
    return item;
  });

  useEffect(() => {
    if (!session || session.role !== "CLIENT") return;
    if (mustComplete && !onOnboarding) {
      router.replace("/client/onboarding");
    }
    if (!mustComplete && onOnboarding) {
      router.replace("/client");
    }
  }, [session, mustComplete, onOnboarding, router]);

  if (mustComplete && !onOnboarding) {
    return (
      <div className="p-8">
        <PageSkeleton />
      </div>
    );
  }

  if (mustComplete && onOnboarding) {
    return <>{children}</>;
  }

  return (
    <>
      <AppShell
        brand={organizationName || PRODUCT_NAME}
        nav={navItems}
        mobileNav={mobileNav}
        onCommandOpen={() => setCmdOpen(true)}
      >
        {children}
      </AppShell>
      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} mode="client" />
    </>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate allow={["CLIENT"]}>
      <ClientShell>{children}</ClientShell>
    </AuthGate>
  );
}
