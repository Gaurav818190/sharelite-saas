import { redirect } from "next/navigation";

import DashboardClient from "./DashboardClient";
import LandingPage from "./LandingPage";

import { getCurrentUser } from "@/lib/supabase-auth";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return <LandingPage />;
  }

  return (
    <DashboardClient
      user={user}
      initialLeads={[]}
      initialCounts={{
        total: 0,
        valid: 0,
        contacted: 0,
        converted: 0,
      }}
      dataError={undefined}
    />
  );
}