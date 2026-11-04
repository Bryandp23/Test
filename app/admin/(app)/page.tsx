import type { Metadata } from "next";
import { listDashboardEvents } from "@/lib/server/events";
import { runMaintenance } from "@/lib/server/maintenance";
import Dashboard from "@/components/admin/Dashboard";

export const metadata: Metadata = { title: "Événements" };

export default async function Page({ searchParams }: { searchParams: Promise<{ interdit?: string }> }) {
  const sp = await searchParams;
  void runMaintenance();
  const events = await listDashboardEvents();
  return (
    <>
      {sp.interdit && (
        <p className="mb-4 rounded-xl bg-warn-50 p-3 text-warn" role="status">
          Cette page est réservée aux administrateurs.
        </p>
      )}
      <Dashboard events={events} now={new Date().toISOString()} />
    </>
  );
}
