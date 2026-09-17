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

const panelClass = "rounded-2xl border p-6";

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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [campaignName, setCampaignName] = useState("");
  const [templateName, setTemplateName] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [entitlements, setEntitlements] =
    useState<Entitlements | null>(null);

  const card = `${panelClass} ${
    dark
      ? "border-white/[0.08] bg-white/[0.02]"
      : "border-slate-200 bg-white shadow-sm"
  }`;

  const inputClass = `mt-2 h-11 w-full rounded-xl border px-3 text-sm outline-none transition ${
    dark
      ? "border-white/10 bg-[#111827] text-white placeholder:text-slate-500 focus:border-cyan-400"
      : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-cyan-500"
  }`;

  const buttonClass =
    "cursor-pointer rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50";

  const load = useCallback(async () => {
    setError(null);
    setSuccess(null);

    try {
      if (activeTab === "campaigns") {
        const response = await fetch("/api/campaigns", {
          cache: "no-store",
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error ?? "Unable to load campaigns.");
        }

        setCampaigns(body.campaigns ?? []);
      }

      if (activeTab === "templates") {
        const response = await fetch("/api/templates", {
          cache: "no-store",
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error ?? "Unable to load templates.");
        }

        setTemplates(body.templates ?? []);
      }

      if (activeTab === "analytics") {
        const response = await fetch("/api/analytics", {
          cache: "no-store",
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error ?? "Unable to load analytics.");
        }

        setAnalytics(body.analytics);
      }

      if (activeTab === "settings") {
        const profileResponse = await fetch("/api/profile", {
          cache: "no-store",
        });

        const profileBody = await profileResponse.json();

        if (!profileResponse.ok) {
          throw new Error(
            profileBody.error ?? "Unable to load profile."
          );
        }

        const currentProfile = profileBody.profile as Profile | null;

        setProfile(currentProfile);
        setName(currentProfile?.name ?? "");
        setFirstName(currentProfile?.first_name ?? "");
        setLastName(currentProfile?.last_name ?? "");

        const subscriptionResponse = await fetch(
          "/api/subscription",
          {
            cache: "no-store",
          }
        );

        const subscriptionBody = await subscriptionResponse.json();

        if (!subscriptionResponse.ok) {
          throw new Error(
            subscriptionBody.error ??
              "Unable to load subscription."
          );
        }

        setEntitlements(subscriptionBody.entitlements);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to load workspace."
      );
    }
  }, [activeTab]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  async function create(kind: "campaign" | "template") {
    setError(null);
    setSuccess(null);

    const path =
      kind === "campaign"
        ? "/api/campaigns"
        : "/api/templates";

    const body =
      kind === "campaign"
        ? { name: campaignName.trim() }
        : {
            name: templateName.trim(),
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
      setError(result.error ?? "Unable to create item.");
      return;
    }

    setCampaignName("");
    setTemplateName("");
    setSuccess(
      kind === "campaign"
        ? "Campaign created successfully."
        : "Template created successfully."
    );

    void load();
  }

  async function removeCampaign(
    id: string,
    campaignNameValue: string
  ) {
    const confirmed = window.confirm(
      `Delete "${campaignNameValue}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/campaigns?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.error ?? "Unable to delete campaign."
        );
      }

      setCampaigns((current) =>
        current.filter((campaign) => campaign.id !== id)
      );

      setSuccess("Campaign deleted successfully.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to delete campaign."
      );
    }
  }

  async function saveProfile() {
  setError(null);
  setSuccess(null);

  if (!firstName.trim()) {
    setError("First name is required.");
    return;
  }

  if (firstName.trim().length > 100) {
    setError("First name must be 100 characters or less.");
    return;
  }

  if (lastName.trim().length > 100) {
    setError("Last name must be 100 characters or less.");
    return;
  }

  if (name.trim().length > 200) {
    setError("Display name must be 200 characters or less.");
    return;
  }

  setSavingProfile(true);

  try {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim() || null,
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(
        body.error ?? "Unable to update profile."
      );
    }

    const savedProfile = body.profile as Profile | null;

    const updatedFirstName =
      typeof savedProfile?.first_name === "string"
        ? savedProfile.first_name.trim()
        : firstName.trim();

    setProfile(savedProfile);
    setName(savedProfile?.name ?? "");
    setFirstName(savedProfile?.first_name ?? "");
    setLastName(savedProfile?.last_name ?? "");

    setSuccess("Profile settings saved successfully.");

    window.dispatchEvent(
      new CustomEvent("sharelite-profile-updated", {
        detail: {
          firstName: updatedFirstName,
        },
      })
    );
  } catch (e) {
    setError(
      e instanceof Error
        ? e.message
        : "Unable to update profile."
    );
  } finally {
    setSavingProfile(false);
  }
}

  if (activeTab === "campaigns") {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-black">Campaigns</h2>
          <p className="text-xs text-slate-400">
            Manage your authenticated campaigns.
          </p>
        </div>

        <div className={card}>
          <div className="flex gap-2">
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Campaign name"
              className={`h-10 flex-1 rounded-xl border px-3 text-sm ${
                dark
                  ? "border-white/10 bg-[#111827] text-white"
                  : "border-slate-200 bg-white text-slate-900"
              }`}
            />

            <button
              onClick={() => void create("campaign")}
              disabled={!campaignName.trim()}
              className={buttonClass}
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

        {success && (
          <p className="text-sm text-emerald-400">{success}</p>
        )}

        <div className="grid gap-3">
          {campaigns.length ? (
            campaigns.map((campaign) => (
              <div key={campaign.id} className={card}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-bold">{campaign.name}</h3>

                    <p className="text-xs text-slate-400">
                      {campaign.description || "No description"}
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
                        campaign.name
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
          <h2 className="text-xl font-black">Templates</h2>
          <p className="text-xs text-slate-400">
            Create reusable outreach templates.
          </p>
        </div>

        <div className={card}>
          <div className="flex gap-2">
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name"
              className={`h-10 flex-1 rounded-xl border px-3 text-sm ${
                dark
                  ? "border-white/10 bg-[#111827] text-white"
                  : "border-slate-200 bg-white text-slate-900"
              }`}
            />

            <button
              onClick={() => void create("template")}
              disabled={!templateName.trim()}
              className={buttonClass}
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

        {success && (
          <p className="text-sm text-emerald-400">{success}</p>
        )}

        <div className="grid gap-3">
          {templates.length ? (
            templates.map((template) => (
              <div key={template.id} className={card}>
                <h3 className="font-bold">{template.name}</h3>

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
        <h2 className="text-xl font-black">Analytics</h2>

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
              ["Conversion rate", `${analytics.conversionRate}%`],
            ].map(([label, value]) => (
              <div key={String(label)} className={card}>
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
                {Object.entries(analytics.validationStatus)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(" · ")}
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  if (activeTab === "settings") {
    const planName =
      entitlements?.plan === "premium_pro"
        ? "Premium Pro"
        : entitlements?.plan === "premium"
          ? "Premium"
          : "Free";

    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-black">Settings</h2>
          <p className="mt-1 text-xs text-slate-400">
            Manage your ShareLite account and profile.
          </p>
        </div>

        <div className={card}>
          <div className="mb-5">
            <h3 className="text-lg font-black">Profile information</h3>

            <p className="mt-1 text-xs text-slate-400">
              Signed in as {user.email ?? "Account"}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-bold">
              First name
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Your first name"
                maxLength={100}
                className={inputClass}
              />
            </label>

            <label className="text-xs font-bold">
              Last name
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Your last name"
                maxLength={100}
                className={inputClass}
              />
            </label>
          </div>

          <label className="mt-4 block text-xs font-bold">
            Display name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How your name appears in ShareLite"
              maxLength={200}
              className={inputClass}
            />
          </label>

          <button
            onClick={() => void saveProfile()}
            disabled={savingProfile}
            className={`mt-5 ${buttonClass}`}
          >
            {savingProfile ? "Saving..." : "Save settings"}
          </button>

          {profile && !error && success && (
            <p className="mt-3 text-xs text-emerald-400">
              {success}
            </p>
          )}
        </div>

        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black">Current plan</h3>

              <p className="mt-1 text-sm font-bold text-cyan-400">
                {planName} plan
              </p>
            </div>

            <a
              href="/plans"
              className="rounded-xl border border-cyan-400/40 px-4 py-2 text-xs font-black text-cyan-400 transition hover:bg-cyan-400/10"
            >
              View plans
            </a>
          </div>

          {entitlements && (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div
                className={`rounded-xl p-4 ${
                  dark ? "bg-white/[0.04]" : "bg-slate-50"
                }`}
              >
                <p className="text-xs text-slate-400">Leads</p>
                <p className="mt-1 text-lg font-black">
                  {entitlements.usage.leads} /{" "}
                  {entitlements.limits.leads}
                </p>
              </div>

              <div
                className={`rounded-xl p-4 ${
                  dark ? "bg-white/[0.04]" : "bg-slate-50"
                }`}
              >
                <p className="text-xs text-slate-400">Campaigns</p>
                <p className="mt-1 text-lg font-black">
                  {entitlements.usage.campaigns} /{" "}
                  {entitlements.limits.campaigns}
                </p>
              </div>

              <div
                className={`rounded-xl p-4 ${
                  dark ? "bg-white/[0.04]" : "bg-slate-50"
                }`}
              >
                <p className="text-xs text-slate-400">Templates</p>
                <p className="mt-1 text-lg font-black">
                  {entitlements.usage.templates} /{" "}
                  {entitlements.limits.templates}
                </p>
              </div>
            </div>
          )}
        </div>

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