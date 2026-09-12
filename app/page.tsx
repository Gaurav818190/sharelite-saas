import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";
import { getCurrentSession } from "@/lib/supabase-auth";
import { countLeads, listLeads } from "@/lib/supabase-db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const result = await loadDashboardData(session.accessToken);
  return <DashboardClient user={session.user} initialLeads={result.leads} initialCounts={result.counts} dataError={result.error} />;
}

async function loadDashboardData(accessToken: string) {
  try {
    const leads = await listLeads(accessToken);
    return { leads, counts: countLeads(leads), error: undefined };
  } catch (error) {
    console.error("ShareLite dashboard data load failed", error);
    return { leads: [], counts: { total: 0, valid: 0, contacted: 0, converted: 0 }, error: "Unable to load dashboard data." };
  }
}
