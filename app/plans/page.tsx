"use client";

import Link from "next/link";
import { type MouseEvent, type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";

type BillingPeriod = "monthly" | "yearly" | "special";
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
      "For agencies and power users needing higher outreach capacity.",
    features: [
      "Unlimited connected email inboxes",
      "10,000 email sends / month",
      "12,000 email validations / month",
      "Hyper-personalized AI outreach",
      "Custom SMTP / Dedicated IP support",
      "Time-zone scheduling",
      "A/B testing",
      "Multi-client workspace",
      "Advanced security & webhooks",
      "Priority support",
    ],
  },
  {
    name: "Ultimate Growth Agency & Enterprise Scale",
    usd: 3199,
    tagline: "Ultimate agency & enterprise scale",
    description:
      "For large agencies and enterprise teams running multi-client outreach.",
    features: [
      "Unlimited connected email inboxes",
      "15,000 email sends / month",
      "20,000 email validations / month",
      "Hyper-personalized AI outreach",
      "Custom SMTP / Dedicated IP support",
      "Time-zone scheduling & A/B testing",
      "Multi-client workspace",
      "Advanced security & webhooks",
      "Dedicated priority support",
    ],
  },
];

function PlanIcon({ name }: { name: string }) {
  const styles: Record<string, string> = {
    Pro: "bg-blue-50 text-blue-600 border-blue-100",
    Business: "bg-violet-50 text-violet-600 border-violet-100",
    Scale: "bg-amber-50 text-amber-600 border-amber-100",
    Enterprise: "bg-emerald-50 text-emerald-600 border-emerald-100",
  };

  const common = "h-4.5 w-4.5";
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${styles[name] ?? "bg-gray-50 text-gray-700 border-gray-200"}`}>
      {name === "Pro" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common}>
          <path d="M13 2 4 14h7l-1 8 10-13h-7l0-7Z" />
        </svg>
      )}
      {name === "Business" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common}>
          <path d="M4 21h16M6 21V7h12v14M9 7V4h6v3M9 11h2M13 11h2M9 15h2M13 15h2" />
        </svg>
      )}
      {name === "Scale" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common}>
          <path d="m12 3 2.2 5.1L20 10l-4.3 3.7 1.2 5.8L12 16.6 7.1 19.5l1.2-5.8L4 10l5.8-1.9L12 3Z" />
        </svg>
      )}
      {name === "Enterprise" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common}>
          <path d="M4 21h16M6 21V4h12v17M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" />
        </svg>
      )}
    </span>
  );
}

function PlanFeatureList({
  features,
  dark = false,
}: {
  features: string[];
  dark?: boolean;
}) {
  return (
    <ul
      className={`mt-3 space-y-1.5 text-[11px] leading-4.5 ${
        dark ? "text-white" : "text-gray-700"
      }`}
    >
      {features.map((feature) => (
        <li key={feature} className="flex items-start gap-2">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[11px] font-black text-green-600">
            ✓
          </span>

          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}


function PlanCTA({
  href,
  children,
  featured = false,
}: {
  href: string;
  children: ReactNode;
  featured?: boolean;
}) {
  const router = useRouter();
  const [pressed, setPressed] = useState(false);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (pressed) return;
    setPressed(true);
    window.setTimeout(() => router.push(href), 260);
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className={`relative isolate mt-3 block overflow-hidden rounded-lg border px-3 py-2 text-center text-[11px] font-medium transition duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97] ${featured ? "border-white bg-white text-black" : "border-black bg-black text-white"} ${
        pressed ? "scale-[0.97]" : ""
      }`}
    >
      <span className="relative z-10">{children}</span>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25 ${
          pressed ? "animate-[planRipple_260ms_ease-out_forwards]" : "opacity-0"
        }`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${
          pressed ? "animate-[planWave_260ms_ease-out]" : ""
        }`}
      />
    </a>
  );
}


function WorkspaceMenu() {
  const items = [
    ["Dashboard", "/dashboard"],
    ["Leads", "/dashboard#leads"],
    ["Campaigns", "/dashboard#campaigns"],
    ["Messages", "/dashboard#messages"],
    ["Templates", "/dashboard#templates"],
    ["Approvals", "/dashboard#approvals"],
    ["Analytics", "/dashboard#analytics"],
    ["Settings", "/dashboard#settings"],
  ];

  return (
    <div className="group relative">
      <button
        type="button"
        className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:text-black"
        aria-haspopup="menu"
      >
        Home
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="transition-transform duration-200 group-hover:rotate-180">
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="pointer-events-none invisible absolute left-0 top-full z-50 w-52 translate-y-1 rounded-xl border border-gray-200 bg-white p-1.5 opacity-0 shadow-xl transition-all duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
        {items.map(([label, href]) => (
          <Link
            key={label}
            href={href}
            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-[12px] font-medium text-gray-700 transition hover:bg-gray-100 hover:text-black"
          >
            <span>{label}</span>
            <span className="text-[10px] text-gray-400">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function PlansPage() {
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [currency, setCurrency] = useState<Currency>("USD");

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-white px-4 py-4 text-black sm:px-6 lg:px-8">
      <style jsx global>{`
        @keyframes planRipple {
          0% { opacity: .30; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(18); }
        }
        @keyframes planWave {
          0% { box-shadow: inset 0 0 0 0 rgba(255,255,255,0); }
          45% { box-shadow: inset 0 0 0 2px rgba(255,255,255,.6); }
          100% { box-shadow: inset 0 0 0 0 rgba(255,255,255,0); }
        }
      `}</style>

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* COMPACT INSTANTLY-STYLE NAVIGATION */}
     <header className="flex h-14 items-center border-b border-gray-100">
  <div className="flex items-center gap-4">
    {/* ShareLite Logo */}
    <Link
      href="/"
      className="flex items-center gap-2.5"
      aria-label="ShareLite home"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white shadow-sm">
        <span className="text-[16px] font-black tracking-tight">S</span>
      </span>

      <span className="text-[17px] font-black tracking-[-0.04em] text-black">
        ShareLite
      </span>
    </Link>

    {/* Home */}
    <Link
      href="/"
      className="ml-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-gray-700 transition duration-200 hover:bg-gray-100 hover:text-black active:scale-[0.97]"
    >
      Home
    </Link>

    {/* Plans */}
    <Link
      href="/plans"
      className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-black transition duration-200 hover:bg-gray-100 active:scale-[0.97]"
    >
      Plans
    </Link>
  </div>
</header>

        {/* COMPACT HERO */}
        <section className="mx-auto mt-3 max-w-4xl text-center">
          <p className="mb-1 text-[8px] font-black uppercase tracking-[0.28em] text-gray-400">
            Simple pricing. Powerful outreach.
          </p>

          <h1 className="text-[30px] font-black tracking-tight sm:text-[34px] md:text-[36px]">
            Choose your ShareLite plan
          </h1>

          <p className="mx-auto mt-1 max-w-3xl text-[11px] leading-4.5 text-gray-600">
            Scale your outreach with validated leads, smarter campaigns,
            AI-powered personalization and flexible inbox options.
          </p>
        </section>

        {/* BILLING + CURRENCY — SAME LINE */}
        <div className="mx-auto mt-3 flex max-w-5xl flex-col items-center justify-center gap-4 sm:flex-row">
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`rounded-full px-4 py-1.5 text-[10px] font-medium transition ${
                billing === "monthly"
                  ? "bg-black text-white shadow-md"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className={`rounded-full px-4 py-1.5 text-[10px] font-medium transition ${
                billing === "yearly"
                  ? "bg-black text-white shadow-md"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Yearly
            </button>
            <button
              type="button"
              onClick={() => setBilling("special")}
              className={`rounded-full px-4 py-1.5 text-[10px] font-medium transition ${
                billing === "special"
                  ? "bg-black text-white shadow-[0_0_0_2px_#d4af37]"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              ✦ Special
            </button>
          </div>

          <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition ${
                  currency === "USD"
                    ? "bg-black text-white shadow-md"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                🌎 USD
              </button>

              <button
                type="button"
                onClick={() => setCurrency("INR")}
                className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition ${
                  currency === "INR"
                    ? "bg-black text-white shadow-md"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                🇮🇳 INR
              </button>
            </div>
        </div>

        {/* TRIAL — ONE COMPACT LINE */}
        <div className="mx-auto mt-2 max-w-6xl rounded-lg border border-gray-200 bg-white px-4 py-2 text-center">
  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-800">
    12-Day Free Trial
  </span>

  <span className="mx-3 text-[10px] text-gray-400">•</span>

  <span className="text-[10px] text-gray-600">
    New accounts receive one trial. It does not restart on login,
    logout, refresh or repeated visits.
  </span>
</div>

        {/* PRICING */}
        {billing !== "special" ? (
          <>
            <section className="mx-auto mt-3 grid max-w-[1220px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                    className={`relative flex min-h-[350px] flex-col rounded-xl border p-3.5 transition duration-200 hover:-translate-y-1 hover:shadow-xl ${
                      plan.featured
                        ? "border-black bg-black text-white shadow-xl"
                        : "border-gray-200 bg-white hover:border-gray-400"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <PlanIcon name={plan.name} />
                      {plan.featured && (
                        <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-black">
                          Popular
                        </span>
                      )}
                    </div>

                    <h2 className={`mt-2 text-[20px] font-black ${plan.featured ? "text-white" : "text-gray-950"}`}>
                      {plan.name}
                    </h2>

                    <p className={`mt-1 min-h-8 text-[11px] leading-4.5 ${plan.featured ? "text-white" : "text-gray-600"}`}>
                      {plan.description}
                    </p>

                    <div className="mt-2.5 flex items-end gap-1">
                      <span className={`font-black leading-none ${currency === "INR" ? "text-3xl" : "text-[36px]"}`}>
                        {getPrice(usdPrice, currency)}
                      </span>
                      <span className={`pb-0.5 text-[10px] ${plan.featured ? "text-gray-300" : "text-gray-600"}`}>
                        {billing === "monthly" ? "/ month" : "/ year"}
                      </span>
                    </div>

                    <PlanFeatureList features={features} dark={plan.featured} />

                    <PlanCTA href={getPlanHref(plan.name, billing, currency)} featured={plan.featured}>
                      {plan.button}
                    </PlanCTA>
                  </article>
                );
              })}
            </section>

            {billing === "yearly" && (
              <div className="mx-auto mt-4 max-w-[1220px] rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-center text-[11px] text-gray-600">
                Need more power? <button type="button" onClick={() => setBilling("special")} className="font-semibold text-black underline underline-offset-2">Explore Special plans →</button>
              </div>
            )}
          </>
        ) : (
          <section className="mx-auto mt-4 max-w-[1220px]">
            <div className="mb-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#9a7a16]">
                Premium Special
              </p>
              <h2 className="mt-1 text-[25px] font-black tracking-tight">
                Maximum outreach. Maximum scale.
              </h2>
              <p className="mx-auto mt-1 max-w-2xl text-[11px] leading-4 text-gray-600">
                Special annual plans for agencies and enterprise teams that need the highest capacity.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {specialYearlyPlans.map((plan, index) => {
                const ultimate = index === 1;

                return (
                  <article
                    key={plan.name}
                    className={`relative overflow-hidden rounded-2xl p-4 transition duration-200 hover:-translate-y-1 ${
                      ultimate
                        ? "border-[4px] border-[#d4af37] bg-black text-white shadow-[0_14px_42px_rgba(212,175,55,0.30)]"
                        : "border-[3px] border-[#d4af37] bg-white text-black shadow-[0_10px_30px_rgba(212,175,55,0.16)]"
                    }`}
                  >
                    <div className="absolute inset-x-0 top-0 h-1.5 bg-[#d4af37]" />

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          ultimate ? "bg-[#d4af37] text-black" : "bg-[#fff7d6] text-[#9a7a16]"
                        }`}>
                          <span className="text-[22px]">{ultimate ? "♛" : "★"}</span>
                        </div>
                        <div>
                          <p className={`text-[8px] font-black uppercase tracking-[0.22em] ${
                            ultimate ? "text-[#f3d77a]" : "text-[#9a7a16]"
                          }`}>
                            {plan.tagline}
                          </p>
                          <h3 className="mt-1 text-[22px] font-black leading-tight">
                            {plan.name}
                          </h3>
                        </div>
                      </div>

                      <span className="shrink-0 rounded-full bg-[#d4af37] px-2.5 py-1 text-[8px] font-black uppercase tracking-wide text-black">
                        Annual Only
                      </span>
                    </div>

                    <p className={`mt-2 text-[11px] leading-4.5 ${
                      ultimate ? "text-white/75" : "text-gray-600"
                    }`}>
                      {plan.description}
                    </p>

                    <div className="mt-3 flex items-end gap-1.5">
                      <span className={`text-[38px] font-black leading-none ${
                        ultimate ? "text-[#f3d77a]" : "text-black"
                      }`}>
                        {getPrice(plan.usd, currency)}
                      </span>
                      <span className={`pb-0.5 text-[10px] ${
                        ultimate ? "text-white/70" : "text-gray-500"
                      }`}>
                        / year
                      </span>
                    </div>

                    <div className="mt-4 grid gap-1.5">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-2 text-[11px] leading-4">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[11px] font-black text-green-500">
  ✓
</span>
                          <span className={ultimate ? "text-white" : "text-gray-700"}>
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>

                    <PlanCTA
                      href={getPlanHref(plan.name, "yearly", currency)}
                      featured={ultimate}
                    >
                      {ultimate ? "Unlock Ultimate Growth →" : "Get Yearly Max →"}
                    </PlanCTA>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* FOOTER */}
        <footer className="mt-7 border-t border-gray-200 pt-3 text-center text-[9px] text-gray-500">
          ShareLite — AI-powered outreach made simple.
        </footer>
      </div>
    </main>
  );
}
