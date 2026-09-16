"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "@/lib/supabase-auth";
import type {
  Campaign,
  CampaignStatus,
  Template,
} from "@/lib/supabase-workspaces";
import type { Profile } from "@/lib/supabase-db";

type Props = {
  activeTab: string;
  user: AuthUser;
  dark: boolean;
};

type Entitlements = {
  plan: "free" | "premium" | "premium_pro";
  limits: {
    leads: number;
    campaigns: number;
    templates: number;
    validation: number;
  };
  usage: {
    leads: number;
    campaigns: number;
    templates: number;
    validation: number;
  };
  features: Record<string, boolean>;
};

type Analytics = {
  total: number;
  valid: number;
  contacted: number;
  converted: number;
  campaigns: number;
  conversionRate: number;
  campaignStatus: Record<CampaignStatus, number>;
  validationStatus: Record<string, number>;
};

const panelClass = "p-6 rounded-2xl border";

export default function WorkspacePanels({
  activeTab,
  user,
  dark,
}: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [entitlements, setEntitlements] =
    useState<Entitlements | null>(null);

  const card = `${panelClass} ${
    dark
      ? "border-white/[0.08] bg-white/[0.02]"
      : "border-slate-200 bg-white shadow-sm"
  }`;

  const load = useCallback(async () => {
    setError(null);

    try {
      if (activeTab === "campaigns") {
        const response = await fetch("/api/campaigns", {
          cache: "no-store",
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error);
        }

        setCampaigns(body.campaigns ?? []);
      }

      if (activeTab === "templates") {
        const response = await fetch("/api/templates", {
          cache: "no-store",
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error);
        }

        setTemplates(body.templates ?? []);
      }

      if (activeTab === "analytics") {
        const response = await fetch("/api/analytics", {
          cache: "no-store",
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error);
        }

        setAnalytics(body.analytics);
      }

      if (activeTab === "settings") {
        const profileResponse = await fetch("/api/profile", {
          cache: "no-store",
        });

        const profileBody = await profileResponse.json();

        if (!profileResponse.ok) {
          throw new Error(profileBody.error);
        }

        setProfile(profileBody.profile);
        setName(profileBody.profile?.name ?? "");

        const subscriptionResponse = await fetch(
          "/api/subscription",
          {
            cache: "no-store",
          },
        );

        const subscriptionBody =
          await subscriptionResponse.json();

        if (!subscriptionResponse.ok) {
          throw new Error(subscriptionBody.error);
        }

        setEntitlements(subscriptionBody.entitlements);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to load workspace.",
      );
    }
  }, [activeTab]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  async function create(
    kind: "campaign" | "template",
  ) {
    const path =
      kind === "campaign"
        ? "/api/campaigns"
        : "/api/templates";

    const body =
      kind === "campaign"
        ? { name: campaignName }
        : {
            name: templateName,
            subject: "Hello from ShareLite",
            body: "Hi,\n\nI wanted to connect with you.",
          };

    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.error);
      return;
    }

    setCampaignName("");
    setTemplateName("");
    void load();
  }

  async function removeCampaign(
    id: string,
    campaignName: string,
  ) {
    const confirmed = window.confirm(
      `Delete "${campaignName}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(
        `/api/campaigns?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.error ?? "Unable to delete campaign.",
        );
      }

      setCampaigns((current) =>
        current.filter((campaign) => campaign.id !== id),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to delete campaign.",
      );
    }
  }

  async function saveProfile() {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    const body = await response.json();

    if (!response.ok) {
      setError(body.error);
    } else {
      setProfile(body.profile);
    }
  }

  if (activeTab === "campaigns") {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-black">
            Campaigns
          </h2>

          <p className="text-xs text-slate-400">
            Manage your authenticated campaigns.
          </p>
        </div>

        <div className={card}>
          <div className="flex gap-2">
            <input
              value={campaignName}
              onChange={(e) =>
                setCampaignName(e.target.value)
              }
              placeholder="Campaign name"
              className="h-10 flex-1 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm"
            />

            <button
              onClick={() => void create("campaign")}
              disabled={!campaignName.trim()}
              className="cursor-pointer rounded-xl bg-cyan-500 px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}

        <div className="grid gap-3">
          {campaigns.length ? (
            campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className={card}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-bold">
                      {campaign.name}
                    </h3>

                    <p className="text-xs text-slate-400">
                      {campaign.description ||
                        "No description"}
                    </p>

                    <span className="mt-2 inline-block text-xs font-bold uppercase text-cyan-400">
                      {campaign.status}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void removeCampaign(
                        campaign.id,
                        campaign.name,
                      )
                    }
                    className="shrink-0 rounded-xl border border-rose-400/30 px-3 py-2 text-xs font-bold text-rose-400 transition hover:bg-rose-500/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className={card}>
              <p className="text-sm text-slate-400">
                No campaigns yet.
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (activeTab === "templates") {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-black">
            Templates
          </h2>

          <p className="text-xs text-slate-400">
            Create reusable outreach templates.
          </p>
        </div>

        <div className={card}>
          <div className="flex gap-2">
            <input
              value={templateName}
              onChange={(e) =>
                setTemplateName(e.target.value)
              }
              placeholder="Template name"
              className="h-10 flex-1 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm"
            />

            <button
              onClick={() => void create("template")}
              disabled={!templateName.trim()}
              className="cursor-pointer rounded-xl bg-cyan-500 px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}

        <div className="grid gap-3">
          {templates.length ? (
            templates.map((template) => (
              <div
                key={template.id}
                className={card}
              >
                <h3 className="font-bold">
                  {template.name}
                </h3>

                <p className="text-xs text-slate-400">
                  {template.subject}
                </p>
              </div>
            ))
          ) : (
            <div className={card}>
              <p className="text-sm text-slate-400">
                No templates yet.
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (activeTab === "analytics") {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-black">
          Analytics
        </h2>

        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}

        {analytics && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ["Leads", analytics.total],
              ["Campaigns", analytics.campaigns],
              ["Converted", analytics.converted],
              [
                "Conversion rate",
                `${analytics.conversionRate}%`,
              ],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className={card}
              >
                <div className="text-xs text-slate-400">
                  {label}
                </div>

                <div className="mt-2 text-2xl font-black">
                  {value}
                </div>
              </div>
            ))}

            <div className={card}>
              <div className="text-xs text-slate-400">
                Email validation
              </div>

              <div className="mt-2 text-sm font-bold">
                {Object.entries(
                  analytics.validationStatus,
                )
                  .map(
                    ([key, value]) =>
                      `${key}: ${value}`,
                  )
                  .join(" · ")}
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  if (activeTab === "settings") {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-black">
          Settings
        </h2>

        <div className={card}>
          <p className="mb-3 text-xs text-slate-400">
            Signed in as {user.email ?? "Account"}
          </p>

          <label className="text-xs font-bold">
            Display name

            <input
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm"
            />
          </label>

          <button
            onClick={() => void saveProfile()}
            className="mt-3 cursor-pointer rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black"
          >
            Save settings
          </button>

          {profile && (
            <p className="mt-2 text-xs text-emerald-400">
              Profile saved.
            </p>
          )}
        </div>

        {entitlements && (
          <div className={card}>
            <h3 className="font-black">
              {entitlements.plan === "premium_pro"
                ? "Premium Pro"
                : entitlements.plan === "premium"
                  ? "Premium"
                  : "Free"}{" "}
              plan
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              Usage: {entitlements.usage.leads}/
              {entitlements.limits.leads} leads ·{" "}
              {entitlements.usage.campaigns}/
              {entitlements.limits.campaigns} campaigns ·{" "}
              {entitlements.usage.templates}/
              {entitlements.limits.templates} templates
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}
      </section>
    );
  }

  return null;
}