"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/hub/theme-toggle";
import { useHubStore } from "@/stores/hub-store";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

function isNavActive(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== "/client" && href !== "/admin" && pathname.startsWith(href))
  );
}

export function AppShell({
  brand,
  nav,
  mobileNav,
  children,
  onCommandOpen,
  onQuickUpdate,
  showQuickUpdate,
}: {
  brand: string;
  nav: NavItem[];
  mobileNav?: NavItem[];
  children: React.ReactNode;
  onCommandOpen?: () => void;
  onQuickUpdate?: () => void;
  showQuickUpdate?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const session = useHubStore((s) => s.session);
  const unread = useHubStore((s) =>
    session ? s.notifications.filter((n) => n.userId === session.id && !n.read).length : 0
  );
  const logout = useHubStore((s) => s.logout);
  const router = useRouter();
  const bottom = mobileNav ?? nav.slice(0, 4);
  const homeHref = session?.role === "CLIENT" ? "/client" : "/admin";
  const profileHref = session?.role === "CLIENT" ? "/client/profile" : "/admin/profile";
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    function onChange() {
      if (mq.matches) setMobileOpen(false);
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    const menuButton = menuButtonRef.current;
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      menuButton?.focus();
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[var(--border)] bg-[var(--bg-base)] transition-[width] duration-base md:flex",
          collapsed ? "w-[68px]" : "w-[240px]"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-[var(--border)] px-3">
          <Link href={homeHref} className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[image:var(--brand-gradient)] text-sm font-semibold text-white shadow-[0_6px_14px_rgba(107,140,255,0.35)]">
              ◈
            </span>
            {!collapsed ? (
              <span className="truncate text-sm font-semibold tracking-tight">{brand}</span>
            ) : null}
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Principal">
          {nav.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors duration-fast hub-focus",
                  active
                    ? "bg-[var(--accent-muted)] text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent-ring)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {!collapsed ? (
                  <>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-semibold text-white">
                        {item.badge}
                      </span>
                    ) : null}
                  </>
                ) : item.badge ? (
                  <span className="sr-only">{item.badge}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border)] p-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hub-focus"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed ? <span>Recolher</span> : null}
          </button>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        id="hub-mobile-drawer"
        role="dialog"
        aria-modal={mobileOpen}
        aria-hidden={!mobileOpen}
        aria-label="Menu"
        inert={!mobileOpen ? true : undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-[60] flex w-[min(280px,85vw)] flex-col border-r border-[var(--border)] bg-[var(--bg-base)] transition-transform duration-base md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-[var(--border)] px-3">
          <Link href={homeHref} className="flex min-w-0 items-center gap-2" onClick={() => setMobileOpen(false)}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[image:var(--brand-gradient)] text-sm font-semibold text-white shadow-[0_6px_14px_rgba(107,140,255,0.35)]">
              ◈
            </span>
            <span className="truncate text-sm font-semibold tracking-tight">{brand}</span>
          </Link>
          <Button
            ref={closeButtonRef}
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Menu completo">
          {nav.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors duration-fast hub-focus",
                  active
                    ? "bg-[var(--accent-muted)] text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent-ring)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-semibold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-base",
          collapsed ? "md:pl-[68px]" : "md:pl-[240px]"
        )}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-base)]/80 px-4 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-1 md:hidden">
            <Button
              ref={menuButtonRef}
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0"
              aria-label="Abrir menu"
              aria-expanded={mobileOpen}
              aria-controls="hub-mobile-drawer"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="truncate text-sm font-semibold">{brand}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {onCommandOpen ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 text-[var(--text-muted)] sm:hidden"
                  onClick={onCommandOpen}
                  aria-label="Buscar"
                >
                  <Search className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden h-9 gap-2 rounded-xl border-[var(--border-strong)] bg-[var(--control-bg)] px-3 text-[var(--text-muted)] sm:inline-flex"
                  onClick={onCommandOpen}
                >
                  <Search className="h-3.5 w-3.5" />
                  Buscar
                  <kbd className="rounded border border-[var(--border)] px-1 text-[10px]">⌘K</kbd>
                </Button>
              </>
            ) : null}
            {showQuickUpdate && onQuickUpdate ? (
              <Button size="sm" variant="accent" onClick={onQuickUpdate}>
                + Update
              </Button>
            ) : null}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label={unread ? `${unread} notificações não lidas` : "Notificações"}
            >
              <Link href={session?.role === "CLIENT" ? "/client/notifications" : "/admin/notifications"}>
                <span className="relative">
                  <Bell className="h-4 w-4" />
                  {unread > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--accent)] px-0.5 text-[9px] text-white">
                      {unread}
                    </span>
                  ) : null}
                </span>
              </Link>
            </Button>
            <div className="ml-1 flex items-center gap-2 border-l border-[var(--border)] pl-3">
              <Link
                href={profileHref}
                aria-label="Perfil"
                className="flex min-w-0 items-center gap-2 rounded-md py-0.5 pr-1 hub-focus hover:bg-[var(--bg-subtle)]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[image:var(--brand-gradient)] text-xs font-medium text-white shadow-[0_6px_14px_rgba(107,140,255,0.35)]">
                  {session?.avatarInitials ?? "?"}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block truncate text-xs font-medium leading-none">{session?.name}</span>
                  {session?.role && session.role !== "CLIENT" ? (
                    <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">{session.role}</span>
                  ) : null}
                </span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sair"
                onClick={() => {
                  void logout().then(() => router.replace("/login"));
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:pb-8">{children}</main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-[var(--border)] bg-[var(--bg-elevated)]/95 backdrop-blur md:hidden"
          aria-label="Navegação mobile"
        >
          {bottom.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] hub-focus",
                  active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
