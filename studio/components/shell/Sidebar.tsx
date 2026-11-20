"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChartNoAxesColumn, GanttChart, Images, LayoutGrid, LogOut, PanelLeftClose, PanelLeftOpen, Settings, Sun } from "lucide-react";
import { useStudio } from "@/lib/client/store";
import { updatePrefs } from "@/lib/client/ops";
import { cx, Tip } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/Logo";
import { logout } from "@/app/login/actions";
import { Dialog as RDialog } from "radix-ui";

export const NAV = [
  { href: "/espace", label: "Mon espace", icon: Sun },
  { href: "/board", label: "Board visuel", icon: LayoutGrid },
  { href: "/calendrier", label: "Calendrier", icon: CalendarDays, soon: "Phase 2" },
  { href: "/timeline", label: "Timeline", icon: GanttChart, soon: "Phase 2" },
  { href: "/mediatheque", label: "Médiathèque", icon: Images },
  { href: "/bilan", label: "Bilan", icon: ChartNoAxesColumn, soon: "Phase 3" },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex flex-col gap-0.5 px-2">
      {NAV.map((n) => {
        const active = path === n.href || path.startsWith(n.href + "/");
        const link = (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors",
              active ? "bg-raised text-fg" : "text-muted hover:bg-surface hover:text-fg",
              collapsed && "justify-center px-0",
            )}
          >
            <n.icon className={cx("size-4 shrink-0", active ? "text-accent" : "text-faint group-hover:text-muted")} aria-hidden />
            {!collapsed && <span className="flex-1 truncate">{n.label}</span>}
            {!collapsed && n.soon && <span className="text-[10px] text-faint">{n.soon}</span>}
          </Link>
        );
        return collapsed ? (
          <Tip key={n.href} label={n.label}>
            {link}
          </Tip>
        ) : (
          link
        );
      })}
    </nav>
  );
}

function Account({ collapsed }: { collapsed: boolean }) {
  const email = useStudio((s) => s.user.email);
  const mode = useStudio((s) => s.mode);
  return (
    <div className={cx("border-t border-line-soft p-2", collapsed && "flex justify-center")}>
      <form action={logout} className={cx("flex items-center gap-2 rounded-md px-2 py-1.5", collapsed && "px-0")}>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] text-fg">{email}</div>
            <div className="text-2xs text-faint">{mode === "supabase" ? "Synchronisé · Supabase" : "Mode local"}</div>
          </div>
        )}
        <button aria-label="Se déconnecter" title="Se déconnecter" className="inline-flex size-7 items-center justify-center rounded-md text-faint hover:bg-surface hover:text-fg">
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const mobileOpen = useStudio((s) => s.sidebarMobileOpen);
  const set = useStudio((s) => s.set);
  return (
    <>
      <aside
        className={cx("hidden shrink-0 flex-col border-r border-line-soft bg-sidebar transition-[width] duration-200 md:flex", collapsed ? "w-[52px]" : "w-[224px]")}
      >
        <div className={cx("flex h-12 items-center gap-2 px-3", collapsed && "justify-center px-0")}>
          <Logo size={24} />
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-semibold tracking-tight">Content Studio</div>
              <div className="text-[10.5px] text-faint">EPHEC</div>
            </div>
          )}
        </div>
        <div className="mt-2 flex-1 overflow-y-auto">
          <NavList collapsed={collapsed} />
        </div>
        <div className={cx("px-2 pb-1", collapsed && "flex justify-center")}>
          <button
            onClick={() => updatePrefs({ sidebarCollapsed: !collapsed })}
            className={cx("flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[12px] text-faint hover:bg-surface hover:text-fg", collapsed && "w-8 justify-center px-0")}
            aria-label={collapsed ? "Déplier la barre latérale" : "Réduire la barre latérale"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            {!collapsed && "Réduire"}
          </button>
        </div>
        <Account collapsed={collapsed} />
      </aside>

      {/* Mobile : tiroir */}
      <RDialog.Root open={mobileOpen} onOpenChange={(o) => set({ sidebarMobileOpen: o })}>
        <RDialog.Portal>
          <RDialog.Overlay className="fixed inset-0 z-50 bg-black/55 animate-fade-in md:hidden" />
          <RDialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-line bg-sidebar animate-fade-in md:hidden">
            <RDialog.Title className="flex h-12 items-center gap-2 px-3 text-[13px] font-semibold">
              <Logo size={24} /> Content Studio
            </RDialog.Title>
            <RDialog.Description className="sr-only">Navigation</RDialog.Description>
            <div className="mt-2 flex-1">
              <NavList collapsed={false} onNavigate={() => set({ sidebarMobileOpen: false })} />
            </div>
            <Account collapsed={false} />
          </RDialog.Content>
        </RDialog.Portal>
      </RDialog.Root>
    </>
  );
}
