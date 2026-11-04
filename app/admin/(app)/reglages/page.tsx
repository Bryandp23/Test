import type { Metadata } from "next";
import { requireUser } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";
import { configuredProviders } from "@/lib/server/connections";
import SettingsForm from "@/components/admin/SettingsForm";

export const metadata: Metadata = { title: "Réglages" };

export default async function Page() {
  await requireUser("admin");
  const s = await getSettings();
  const providers = configuredProviders();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold sm:text-3xl">Réglages</h1>
      <SettingsForm
        initial={{
          publicBaseUrl: s.publicBaseUrl,
          defaultReminderMinutes: s.defaultReminderMinutes,
          organizerName: s.organizerName,
          organizerEmail: s.organizerEmail,
          organizerPhone: s.organizerPhone,
          logoUrl: s.logoUrl,
          enableYahoo: s.enableYahoo,
          statsRetentionDays: s.statsRetentionDays,
        }}
        envBaseUrl={process.env.PUBLIC_BASE_URL ?? null}
        hasIntegrationKey={!!s.integrationKeyHash}
        providers={{ google: providers.includes("google"), microsoft: providers.includes("microsoft") }}
      />
    </div>
  );
}
