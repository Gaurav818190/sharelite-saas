"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Profile = {
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
};

type Subscription = {
  plan?: string | null;
  status?: string | null;
  current_period_end?: string | null;
  current_period_start?: string | null;
};

type Entitlements = {
  leads?: number;
  email_sends?: number;
  email_validations?: number;
  [key: string]: unknown;
};

type SubscriptionResponse = {
  subscription: Subscription;
  trialEndsAt: string | null;
  entitlements: Entitlements | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function capitalize(value: string | null | undefined) {
  if (!value) return "Free";

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscriptionData, setSubscriptionData] =
    useState<SubscriptionResponse | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const [profileResponse, subscriptionResponse] =
          await Promise.all([
            fetch("/api/profile", {
              cache: "no-store",
            }),
            fetch("/api/subscription", {
              cache: "no-store",
            }),
          ]);

        if (profileResponse.ok) {
          const profileJson = await profileResponse.json();
          const nextProfile = profileJson.profile as Profile | null;

          setProfile(nextProfile);
          setFirstName(nextProfile?.first_name ?? "");
          setLastName(nextProfile?.last_name ?? "");
        }

        if (subscriptionResponse.ok) {
          const subscriptionJson =
            (await subscriptionResponse.json()) as SubscriptionResponse;

          setSubscriptionData(subscriptionJson);
        }
      } catch {
        setMessage("Unable to load settings.");
      } finally {
        setLoading(false);
      }
    }

    void loadSettings();
  }, []);

  async function saveProfile() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          name: [firstName.trim(), lastName.trim()]
            .filter(Boolean)
            .join(" "),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(
          typeof data?.error === "string"
            ? data.error
            : "Unable to save profile.",
        );
        return;
      }

      setProfile(data.profile ?? null);
      setMessage("Profile updated successfully.");
    } catch {
      setMessage("Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      window.location.href = "/login";
    }
  }

  const subscription = subscriptionData?.subscription;
  const trialEndsAt = subscriptionData?.trialEndsAt;

  const isTrial =
    subscription?.status === "trialing" && Boolean(trialEndsAt);

  const currentPlan = capitalize(subscription?.plan);

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-slate-400 transition hover:text-white"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="mt-5 text-3xl font-black tracking-tight md:text-4xl">
              Settings
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Manage your ShareLite account, profile and subscription.
            </p>
          </div>

          <Link
            href="/plans"
            className="rounded-xl bg-gradient-to-r from-gray-600 to-gray-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-gray-950/30 transition hover:scale-[1.02]"
          >
            Upgrade Plan
          </Link>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
            Loading your settings...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile */}
            <section className="rounded-3xl border border-gray-400/20 bg-gradient-to-br from-gray-950/30 via-white/[0.03] to-transparent p-6 shadow-2xl shadow-gray-950/10">
              <div className="mb-6">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
                  Account
                </p>

                <h2 className="mt-2 text-xl font-black">
                  Profile information
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Keep your ShareLite profile information up to date.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-300">
                    First name
                  </label>

                  <input
                    value={firstName}
                    onChange={(event) =>
                      setFirstName(event.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-gray-400/60"
                    placeholder="First name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-300">
                    Last name
                  </label>

                  <input
                    value={lastName}
                    onChange={(event) =>
                      setLastName(event.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-gray-400/60"
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Email
                </label>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
                  {profile?.email ?? "Your account email"}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={saving || !firstName.trim()}
                  className="rounded-xl bg-gray-600 px-5 py-3 text-sm font-black text-white transition hover:bg-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>

                {message && (
                  <p className="text-sm text-slate-400">{message}</p>
                )}
              </div>
            </section>

            {/* Subscription */}
            <section className="rounded-3xl border border-gray-400/20 bg-gradient-to-br from-gray-950/25 via-white/[0.03] to-transparent p-6 shadow-2xl shadow-gray-950/10">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
                    Subscription
                  </p>

                  <h2 className="mt-2 text-xl font-black">
                    Your ShareLite plan
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    Your current subscription and trial information.
                  </p>
                </div>

                <div className="rounded-full border border-gray-400/30 bg-gray-400/10 px-4 py-2 text-xs font-black text-gray-300">
                  {isTrial ? "FREE TRIAL" : currentPlan.toUpperCase()}
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Current plan
                  </p>

                  <p className="mt-2 text-xl font-black">
                    {currentPlan}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Status
                  </p>

                  <p className="mt-2 text-xl font-black">
                    {capitalize(subscription?.status)}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Trial / Period ends
                  </p>

                  <p className="mt-2 text-xl font-black">
                    {formatDate(
                      trialEndsAt ??
                        subscription?.current_period_end,
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/plans"
                  className="rounded-xl bg-gradient-to-r from-gray-500 to-gray-300 px-5 py-3 text-sm font-black text-black transition hover:scale-[1.02]"
                >
                  View All Plans
                </Link>

                <Link
                  href="/dashboard"
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08]"
                >
                  Open Dashboard
                </Link>
              </div>
            </section>

            {/* Usage */}
            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
                  Usage
                </p>

                <h2 className="mt-2 text-xl font-black">
                  Account usage
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Your current plan entitlements are shown here.
                </p>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Lead limit
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {subscriptionData?.entitlements?.leads ??
                      "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Email sends
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {subscriptionData?.entitlements
                      ?.email_sends ?? "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Validations
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {subscriptionData?.entitlements
                      ?.email_validations ?? "—"}
                  </p>
                </div>
              </div>
            </section>

            {/* Security */}
            <section className="rounded-3xl border border-gray-400/10 bg-gray-400/[0.025] p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-300">
                  Account
                </p>

                <h2 className="mt-2 text-xl font-black">
                  Security & session
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Sign out from your current ShareLite session.
                </p>
              </div>

              <button
                type="button"
                onClick={logout}
                className="mt-6 rounded-xl border border-gray-400/30 bg-gray-400/10 px-5 py-3 text-sm font-black text-gray-200 transition hover:bg-gray-400/20"
              >
                Log Out
              </button>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}