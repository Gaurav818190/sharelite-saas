"use client";

import Link from "next/link";
import { useState } from "react";

type BillingPeriod = "monthly" | "yearly";
type Currency = "USD" | "INR";

const USD_TO_INR_RATE = 95.95;

function usdToInr(usd: number): number {
  const converted = Math.ceil(usd * USD_TO_INR_RATE);
  const remainder = converted % 10;
  if (remainder === 9) return converted;
  return converted + (9 - remainder + 10) % 10;
}

function formatPrice(amount: number, currency: Currency): string {
  return currency === "INR"
    ? `₹${amount.toLocaleString("en-IN")}`
    : `$${amount.toLocaleString("en-US")}`;
}

function getPrice(usd: number, currency: Currency): string {
  return formatPrice(currency === "INR" ? usdToInr(usd) : usd, currency);
}

function getPlanHref(
  plan: string,
  billing: BillingPeriod,
  currency: Currency,
): string {
  return `/login?plan=${encodeURIComponent(plan)}&billing=${billing}&currency=${currency}`;
}

type NormalPlan = {
  name: string;
  monthlyUsd: number;
  yearlyUsd: number;
  description: string;
  monthlyFeatures: string[];
  yearlyFeatures: string[];
  featured?: boolean;
  button: string;
};

const normalPlans: NormalPlan[] = [
  {
    name: "Pro",
    monthlyUsd: 29,
    yearlyUsd: 290,
    description: "For individuals and small outreach teams.",
    monthlyFeatures: [
      "10 connected email inboxes",
      "1,500 email sends / month",
      "2,000 email validations / month",
      "Smart daily delay & rotation",
      "Basic outreach templates",
      "Email tracking",
      "Standard campaign analytics",
      "Lead management",
    ],
    yearlyFeatures: [
      "10 connected email inboxes",
      "1,500 email sends / month",
      "2,000 email validations / month",
      "Smart daily delay & rotation",
      "Basic outreach templates",
      "Email tracking",
      "Standard campaign analytics",
      "Lead management",
      "Monthly limits reset every month for 12 months",
    ],
    button: "Start Pro",
  },
  {
    name: "Business",
    monthlyUsd: 49,
    yearlyUsd: 470,
    description: "For growing businesses and sales teams.",
    monthlyFeatures: [
      "25 connected email inboxes",
      "3,000 email sends / month",
      "4,000 email validations / month",
      "AI-powered icebreaker suggestions (BYOK)",
      "Advanced outreach templates",
      "Delivery lifecycle tracking",
      "Advanced campaign analytics",
      "Lead management",
      "Priority support",
    ],
    yearlyFeatures: [
      "25 connected email inboxes",
      "3,000 email sends / month",
      "4,000 email validations / month",
      "AI-powered icebreaker suggestions (BYOK)",
      "Advanced outreach templates",
      "Delivery lifecycle tracking",
      "Advanced campaign analytics",
      "Lead management",
      "Priority support",
      "Monthly limits reset every month for 12 months",
    ],
    button: "Start Business",
  },
  {
    name: "Scale",
    monthlyUsd: 79,
    yearlyUsd: 750,
    description: "For agencies and scaling outreach teams.",
    monthlyFeatures: [
      "50 connected email inboxes",
      "4,500 email sends / month",
      "6,000 email validations / month",
      "Hyper-personalized AI outreach (BYOK)",
      "Image personalization",
      "Time-zone based scheduling",
      "A/B testing",
      "Advanced analytics & reports",
      "Advanced security / RLS",
      "Priority support",
    ],
    yearlyFeatures: [
      "50 connected email inboxes",
      "4,500 email sends / month",
      "6,000 email validations / month",
      "Hyper-personalized AI outreach (BYOK)",
      "Image personalization",
      "Time-zone based scheduling",
      "A/B testing",
      "Advanced analytics & reports",
      "Advanced security / RLS",
      "Priority support",
      "Monthly limits reset every month for 12 months",
    ],
    featured: true,
    button: "Start Scale",
  },
  {
    name: "Enterprise",
    monthlyUsd: 109,
    yearlyUsd: 1050,
    description: "For high-volume sales teams and advanced operations.",
    monthlyFeatures: [
      "100 connected email inboxes",
      "6,000 email sends / month",
      "8,000 email validations / month",
      "Full AI SDR automation",
      "Advanced campaign automation",
      "Multi-client workspace management",
      "White-label support",
      "Advanced API access",
      "Advanced analytics & reporting",
      "Dedicated / priority support",
    ],
    yearlyFeatures: [
      "100 connected email inboxes",
      "6,000 email sends / month",
      "8,000 email validations / month",
      "Full AI SDR automation",
      "Advanced campaign automation",
      "Multi-client workspace management",
      "White-label support",
      "Advanced API access",
      "Advanced analytics & reporting",
      "Dedicated / priority support",
      "Monthly limits reset every month for 12 months",
    ],
    button: "Start Enterprise",
  },
];

const specialYearlyPlans = [
  {
    name: "Yearly Max",
    usd: 2499,
    tagline: "Premium enterprise scale",
    description:
      "Annual-only premium plan for power users and agencies that need more monthly outreach capacity and flexible inbox management.",
    features: [
      "Unlimited connected email inboxes (Fair Use)",
      "10,000 email sends / month",
      "12,000 email validations / month",
      "Hyper-personalized AI outreach (BYOK)",
      "Custom SMTP / Dedicated IP setup support",
      "Time-zone based scheduling",
      "A/B testing",
      "Multi-client workspace management",
      "Advanced security, RLS & Webhooks",
      "Dedicated priority support",
      "Monthly limits reset every month",
      "12 monthly allowances during the 1-year subscription",
      "Annual billing only",
    ],
    accent: "gold",
  },
  {
    name: "Ultimate Growth Agency & Enterprise Scale",
    usd: 3199,
    tagline: "Ultimate agency and enterprise scale",
    description:
      "Annual-only top tier for large agencies and enterprise teams running advanced multi-client outreach operations.",
    features: [
      "Unlimited connected email inboxes (Fair Use)",
      "15,000 email sends / month",
      "20,000 email validations / month",
      "Hyper-personalized AI outreach (BYOK)",
      "Custom SMTP / Dedicated IP setup support",
      "Time-zone scheduling & A/B testing",
      "Multi-client workspace management",
      "Advanced security, RLS & Webhooks",
      "Dedicated priority support",
      "Monthly limits reset every month",
      "12 monthly allowances during the 1-year subscription",
      "Annual billing only",
    ],
    accent: "violet",
  },
];

function PlanFeatureList({
  features,
  featured,
}: {
  features: string[];
  featured?: boolean;
}) {
  return (
    <ul className="mt-4 space-y-1.5 text-[11px] leading-4.5 text-slate-300">
      {features.map((feature) => (
        <li key={feature} className="flex gap-2">
          <span
            className={
              featured
                ? "shrink-0 text-amber-400"
                : "shrink-0 text-purple-400"
            }
          >
            ✓
          </span>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PlansPage() {
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [currency, setCurrency] = useState<Currency>("USD");

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-black px-4 py-4 text-white sm:px-6 lg:px-8">
      {/* BLACK + SPARKING BACKGROUND */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(124,58,237,0.13),transparent_35%),radial-gradient(circle_at_15%_55%,rgba(34,211,238,0.05),transparent_28%),radial-gradient(circle_at_85%_55%,rgba(245,158,11,0.05),transparent_28%)]" />

        <div className="spark spark-1" />
        <div className="spark spark-2" />
        <div className="spark spark-3" />
        <div className="spark spark-4" />
        <div className="spark spark-5" />
        <div className="spark spark-6" />
        <div className="spark spark-7" />
        <div className="spark spark-8" />
        <div className="spark spark-9" />
        <div className="spark spark-10" />
        <div className="spark spark-11" />
        <div className="spark spark-12" />
      </div>

      <style jsx global>{`
        @keyframes shareliteSpark {
          0%, 100% {
            opacity: 0.12;
            transform: scale(0.55);
          }
          50% {
            opacity: 0.95;
            transform: scale(1.25);
          }
        }

        .spark {
          position: absolute;
          width: 2px;
          height: 2px;
          border-radius: 9999px;
          background: white;
          box-shadow: 0 0 7px 2px rgba(168, 85, 247, 0.55);
          animation: shareliteSpark 2.8s ease-in-out infinite;
        }

        .spark::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: 10px;
          height: 1px;
          transform: translate(-50%, -50%);
          background: rgba(255,255,255,0.55);
          box-shadow: 0 0 5px rgba(255,255,255,0.4);
        }

        .spark-1 { left: 7%; top: 18%; animation-delay: .2s; }
        .spark-2 { left: 17%; top: 48%; animation-delay: 1.1s; }
        .spark-3 { left: 28%; top: 14%; animation-delay: .7s; }
        .spark-4 { left: 39%; top: 62%; animation-delay: 1.8s; }
        .spark-5 { left: 51%; top: 23%; animation-delay: .4s; }
        .spark-6 { left: 62%; top: 72%; animation-delay: 1.4s; }
        .spark-7 { left: 73%; top: 15%; animation-delay: 2s; }
        .spark-8 { left: 82%; top: 43%; animation-delay: .9s; }
        .spark-9 { left: 92%; top: 22%; animation-delay: 1.6s; }
        .spark-10 { left: 13%; top: 82%; animation-delay: 2.2s; }
        .spark-11 { left: 69%; top: 88%; animation-delay: .3s; }
        .spark-12 { left: 88%; top: 78%; animation-delay: 1.2s; }
      `}</style>

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* TOP BAR — ONLY SHARELITE PLANS ON RIGHT */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-[11px] font-bold text-slate-300 transition hover:text-purple-300"
          >
            ← Back to Dashboard
          </Link>

          <div className="rounded-full border border-purple-400/40 bg-purple-400/10 px-3 py-1.5 text-[10px] font-bold text-purple-300">
            ShareLite Plans
          </div>
        </div>

        {/* COMPACT HERO */}
        <section className="mx-auto mt-5 max-w-4xl text-center">
          <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.3em] text-purple-400">
            Simple pricing. Powerful outreach.
          </p>

          <h1 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
            Choose your ShareLite plan
          </h1>

          <p className="mx-auto mt-2 max-w-3xl text-[11px] leading-5 text-slate-400 sm:text-xs">
            Scale your outreach with validated leads, smarter campaigns,
            AI-powered personalization and flexible inbox options.
          </p>
        </section>

        {/* COMPACT INFO ROW */}
        <section className="mx-auto mt-5 grid max-w-5xl grid-cols-1 gap-3 md:grid-cols-2">
          <article className="rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.045] px-4 py-3">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-cyan-400">
              Email Inbox Options
            </p>

            <h2 className="mt-1 text-base font-black">
              Bring your own inbox or connect a new one
            </h2>

            <p className="mt-1 text-[10px] leading-4 text-slate-400">
              Connect Gmail, Google Workspace, Outlook, Zoho or supported SMTP
              inboxes. Guided Google Workspace setup is supported.
            </p>

            <div className="mt-2 rounded-xl border border-purple-400/20 bg-purple-400/[0.04] px-3 py-2">
              <span className="text-[10px] font-black text-purple-200">
                🎥 How to connect a Google inbox
              </span>
              <span className="ml-2 text-[9px] text-slate-500">
                Video guide coming here.
              </span>
            </div>
          </article>

          <article className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.045] px-4 py-3">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-400">
              Sending Safety
            </p>

            <h2 className="mt-1 text-base font-black">
              Protect your inbox reputation
            </h2>

            <p className="mt-1 text-[10px] leading-4 text-slate-400">
              Follow your email provider&apos;s sending policies and recommended
              limits to protect deliverability.
            </p>

            <div className="mt-2 rounded-xl border border-amber-400/20 bg-black/25 px-3 py-2">
              <div className="text-[10px] font-black text-amber-200">
                🛡️ 100 ShareLite emails per connected inbox / day
              </div>
              <p className="mt-0.5 text-[9px] leading-4 text-slate-500">
                ShareLite safety cap. Your plan&apos;s monthly allowance still
                applies.
              </p>
            </div>
          </article>
        </section>

        {/* BILLING + CURRENCY — SAME LINE */}
        <div className="mx-auto mt-4 flex max-w-5xl items-center justify-between gap-3">
          <div className="flex-1" />

          <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`rounded-lg px-5 py-2 text-[11px] font-black transition ${
                billing === "monthly"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-950/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className={`rounded-lg px-5 py-2 text-[11px] font-black transition ${
                billing === "yearly"
                  ? "bg-gradient-to-r from-purple-600 to-amber-500 text-white shadow-lg shadow-purple-950/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Yearly
            </button>
          </div>

          <div className="flex flex-1 justify-end">
            <div className="flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={`rounded-lg px-3 py-2 text-[11px] font-black transition ${
                  currency === "USD"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-950/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🌎 USD
              </button>

              <button
                type="button"
                onClick={() => setCurrency("INR")}
                className={`rounded-lg px-3 py-2 text-[11px] font-black transition ${
                  currency === "INR"
                    ? "bg-gradient-to-r from-purple-600 to-amber-500 text-white shadow-lg shadow-purple-950/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🇮🇳 INR
              </button>
            </div>
          </div>
        </div>

        {/* TRIAL — ONE COMPACT LINE */}
        <div className="mx-auto mt-3 max-w-5xl rounded-xl border border-emerald-400/20 bg-emerald-400/[0.035] px-3 py-2 text-center">
          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-400">
            12-Day Free Trial
          </span>
          <span className="mx-2 text-[9px] text-slate-600">•</span>
          <span className="text-[10px] text-slate-400">
            New accounts receive one trial. It does not restart on login,
            logout, refresh or repeated visits.
          </span>
        </div>

        {/* PRICING — MOVED UP */}
        <section className="mx-auto mt-4 grid max-w-7xl grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {normalPlans.map((plan) => {
            const usdPrice =
              billing === "monthly" ? plan.monthlyUsd : plan.yearlyUsd;

            const features =
              billing === "monthly"
                ? plan.monthlyFeatures
                : plan.yearlyFeatures;

            return (
              <article
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-4 transition hover:-translate-y-1 ${
                  plan.featured
                    ? "border-amber-400 bg-gradient-to-b from-amber-950/60 via-[#17110a] to-black shadow-2xl shadow-amber-950/40"
                    : "border-purple-400/30 bg-gradient-to-b from-purple-950/20 to-white/[0.02] hover:border-purple-400/70"
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-2.5 left-4 rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-black">
                    Most Popular
                  </div>
                )}

                <h2
                  className={`text-lg font-black ${
                    plan.featured ? "text-amber-100" : "text-purple-100"
                  }`}
                >
                  {plan.name}
                </h2>

                <p className="mt-1.5 min-h-9 text-[10px] leading-4 text-slate-400">
                  {plan.description}
                </p>

                <div className="mt-3 flex items-end gap-1.5">
                  <span
                    className={`font-black leading-none ${
                      currency === "INR" ? "text-2xl" : "text-3xl"
                    }`}
                  >
                    {getPrice(usdPrice, currency)}
                  </span>

                  <span className="pb-0.5 text-[9px] text-slate-400">
                    {billing === "monthly" ? "/ month" : "/ year"}
                  </span>
                </div>

                <PlanFeatureList
                  features={features}
                  featured={plan.featured}
                />

                <Link
                  href={getPlanHref(plan.name, billing, currency)}
                  className={`mt-5 block rounded-lg px-3 py-2 text-center text-[10px] font-black transition hover:scale-[1.02] ${
                    plan.featured
                      ? "bg-gradient-to-r from-amber-500 to-yellow-300 text-black"
                      : "border border-purple-400/40 bg-purple-400/10 text-purple-100 hover:bg-purple-400/20"
                  }`}
                >
                  {plan.button}
                </Link>
              </article>
            );
          })}
        </section>

        {/* SPECIAL YEARLY PLANS */}
        {billing === "yearly" && (
          <section className="mx-auto mt-8 max-w-7xl">
            <div className="mb-4 text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-400">
                Special annual tiers
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Built for agencies and enterprise scale
              </h2>
              <p className="mx-auto mt-1 max-w-2xl text-[10px] leading-4 text-slate-400">
                Annual-only premium tiers with monthly sending and validation
                allowances during the 12-month subscription.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {specialYearlyPlans.map((plan) => (
                <article
                  key={plan.name}
                  className={`relative overflow-hidden rounded-2xl border p-4 ${
                    plan.accent === "gold"
                      ? "border-amber-400/60 bg-gradient-to-br from-amber-950/70 via-purple-950/30 to-black"
                      : "border-purple-400/50 bg-gradient-to-br from-purple-950/60 via-[#0b1020] to-black"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p
                        className={`text-[9px] font-black uppercase tracking-[0.2em] ${
                          plan.accent === "gold"
                            ? "text-amber-400"
                            : "text-purple-400"
                        }`}
                      >
                        {plan.tagline}
                      </p>

                      <h3 className="mt-1 text-xl font-black">{plan.name}</h3>
                    </div>

                    <span className="shrink-0 rounded-full bg-white/5 px-2 py-1 text-[8px] font-black uppercase text-slate-400">
                      Annual Only
                    </span>
                  </div>

                  <p className="mt-1.5 text-[10px] leading-4 text-slate-400">
                    {plan.description}
                  </p>

                  <div className="mt-3">
                    <span className="text-3xl font-black">
                      {getPrice(plan.usd, currency)}
                    </span>
                    <span className="ml-1 text-[9px] text-slate-400">
                      / year
                    </span>
                  </div>

                  <PlanFeatureList features={plan.features} />

                  <Link
                    href={getPlanHref(plan.name, "yearly", currency)}
                    className={`mt-5 block rounded-lg px-4 py-2 text-center text-[10px] font-black ${
                      plan.accent === "gold"
                        ? "bg-gradient-to-r from-amber-500 to-yellow-300 text-black"
                        : "bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white"
                    }`}
                  >
                    {plan.name === "Yearly Max"
                      ? "Get Yearly Max →"
                      : "Unlock Ultimate Growth →"}
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* FOOTER */}
        <footer className="mt-7 border-t border-white/10 pt-3 text-center text-[9px] text-slate-600">
          ShareLite — AI-powered outreach made simple.
        </footer>
      </div>
    </main>
  );
}
