import { requireUserPage } from "@/lib/server/auth";
import { asUser } from "@/lib/server/db";
import { ensureDefaults, loadBoard } from "@/lib/server/repo";
import { mode } from "@/lib/server/config";
import { redirect } from "next/navigation";
import { StudioRoot } from "@/components/shell/StudioRoot";
import type { BoardData } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (mode() === "unconfigured") redirect("/setup");
  const user = await requireUserPage();
  const data = await asUser(user.id, async (tx) => {
    await ensureDefaults(tx);
    return loadBoard(tx);
  });
  const initial: BoardData = { ...data, user: { email: user.email }, mode: mode() as "supabase" | "local", loadedAt: Date.now() };
  return <StudioRoot initial={initial}>{children}</StudioRoot>;
}
