"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/admin", label: "Événements", match: (p: string) => p === "/admin" || p.startsWith("/admin/evenements") },
    { href: "/admin/statistiques", label: "Statistiques" },
    { href: "/admin/aide", label: "Aide" },
    ...(isAdmin
      ? [
          { href: "/admin/reglages", label: "Réglages" },
          { href: "/admin/utilisateurs", label: "Utilisateurs" },
        ]
      : []),
  ];
  return (
    <nav aria-label="Navigation principale" className="order-3 w-full overflow-x-auto sm:order-none sm:w-auto">
      <ul className="flex gap-1">
        {items.map((it) => {
          const active = it.match ? it.match(path) : path.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-10 items-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold ${active ? "bg-brand-50 text-brand-800" : "text-muted hover:bg-canvas hover:text-ink"}`}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
