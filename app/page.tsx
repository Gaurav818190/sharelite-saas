import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";
import { getCurrentSession } from "@/lib/supabase-auth";
import { countLeads, getProfile, listLeads } from "@/lib/supabase-db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const result = await loadDashboardData(session.accessToken, session.user.id);
  return <DashboardClient user={session.user} profile={result.profile} initialLeads={result.leads} initialCounts={result.counts} dataError={result.error} />;
}

async function loadDashboardData(accessToken: string, userId: string) {
  try {
    const [leads, profile] = await Promise.all([listLeads(accessToken), getProfile(accessToken, userId)]);
    return { leads, profile, counts: countLeads(leads), error: undefined };
  } catch (error) {
    console.error("ShareLite dashboard data load failed", error);
    return { leads: [], profile: null, counts: { total: 0, valid: 0, contacted: 0, converted: 0 }, error: "Unable to load dashboard data." };
  }
}
