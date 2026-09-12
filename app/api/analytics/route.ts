import { NextResponse } from "next/server";
import { requireAuthenticatedUser, listLeads } from "@/lib/supabase-db";
import { listCampaigns, buildAnalytics } from "@/lib/supabase-workspaces";
import { getCurrentEntitlements } from "@/lib/monetization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user, accessToken } = await requireAuthenticatedUser();
    const range = new URL(request.url).searchParams.get("range");
    const days = range === "3m" ? 90 : range === "30d" ? 30 : 7;
    const [leads, campaigns, entitlements] = await Promise.all([listLeads(accessToken), listCampaigns(accessToken), getCurrentEntitlements(accessToken, user.id)]);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const performance = Array.from({ length: days }, (_, index) => {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() - (days - 1 - index));
      const key = date.toISOString().slice(0, 10);
      return { date: key, leads: leads.filter((lead) => lead.created_at.slice(0, 10) === key).length, campaigns: campaigns.filter((campaign) => campaign.created_at.slice(0, 10) === key).length };
    });
    return NextResponse.json({ analytics: buildAnalytics(leads, campaigns), performance, usage: entitlements.usage, limits: entitlements.limits, plan: entitlements.plan });
  } catch (error) {
    const unauthenticated = error instanceof Error && error.message === "UNAUTHENTICATED";
    return NextResponse.json({ error: unauthenticated ? "Authentication required." : "Unable to load analytics." }, { status: unauthenticated ? 401 : 500 });
  }
}
