import DashboardClient from "../DashboardClient";
import {
  requireAuthenticatedUser,
  listLeads,
  countLeads,
} from "../../lib/supabase-db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, accessToken } = await requireAuthenticatedUser();

  const initialLeads = await listLeads(accessToken);
  const initialCounts = countLeads(initialLeads);

  return (
    <DashboardClient
      user={user}
      initialLeads={initialLeads}
      initialCounts={initialCounts}
    />
  );
}