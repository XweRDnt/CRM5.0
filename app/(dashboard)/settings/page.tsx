import { SettingsPageClient } from "@/components/settings/SettingsPageClient";
import { requireServerSession } from "@/lib/server/session";
import { getSystemHealth } from "@/lib/server/system-health";

export default async function SettingsPage(): Promise<JSX.Element> {
  const session = await requireServerSession("/settings");
  const initialHealth = await getSystemHealth();

  return <SettingsPageClient user={session.user} initialHealth={initialHealth} />;
}
