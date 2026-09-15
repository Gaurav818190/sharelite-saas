import Link from "next/link";
console.log("PLANS PAGE LOADED");
const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "5-day free trial",
    description: "Try ShareLite and explore the basics.",
    features: [
      "Basic lead management",
      "Limited lead records",
      "Basic email validation",
      "Limited AI messages",
    ],
    button: "Start Free Trial",
    featured: false,
  },
  {
    name: "Starter",
    price: "₹499",
    period: "per month",
    description: "For individuals starting outreach.",
    features: [
      "More leads",
      "Email validation",
      "AI message generation",
      "Basic campaign tools",
    ],
    button: "Choose Starter",
    featured: false,
  },
  {
    name: "Pro",
    price: "₹1,499",
    period: "per month",
    description: "For growing outreach businesses.",
    features: [
      "Higher lead limits",
      "Advanced AI personalization",
      "Campaign analytics",
      "Priority features",
    ],
    button: "Choose Pro",
    featured: true,
  },
  {
    name: "Business",
    price: "₹2,499",
    period: "per month",
    description: "For teams and serious outreach.",
    features: [
      "Highest lead limits",
      "Advanced campaign tools",
      "Team-ready workspace",
      "Premium support features",
    ],
    button: "Choose Business",
    featured: false,
  },
];

export default function PlansPage() {
  return (
    <main className="min-h-screen bg-[#070a12] px-5 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-bold text-slate-300 transition hover:text-white"
          >
            ← Back to Dashboard
          </Link>

          <div className="rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-300">
            ShareLite Plans
          </div>
        </div>

        <section className="mx-auto mb-12 max-w-3xl text-center">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-amber-400">
            Simple pricing. Powerful outreach.
          </p>

          <h1 className="text-4xl font-black tracking-tight md:text-6xl">
            Choose your ShareLite plan
          </h1>

          <p className="mt-5 text-sm leading-7 text-slate-400 md:text-base">
            Start free, grow with confidence, and unlock more powerful
            outreach tools when your business is ready.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative flex flex-col rounded-3xl border p-6 ${
                plan.featured
                  ? "border-purple-400/70 bg-gradient-to-b from-purple-900/60 to-slate-950 shadow-2xl shadow-purple-950/40"
                  : "border-white/10 bg-white/[0.04]"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-purple-600 to-amber-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider">
                  Most Popular
                </div>
              )}

              <h2 className="text-xl font-black">{plan.name}</h2>

              <p className="mt-3 min-h-12 text-sm text-slate-400">
                {plan.description}
              </p>

              <div className="mt-6">
                <span className="text-4xl font-black">{plan.price}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {plan.period}
                </span>
              </div>

              <ul className="mt-7 flex-1 space-y-3 text-sm text-slate-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/"
                className={`mt-8 block rounded-xl px-4 py-3 text-center text-sm font-black transition hover:scale-[1.02] ${
                  plan.featured
                    ? "bg-gradient-to-r from-purple-600 via-fuchsia-600 to-amber-500 text-white"
                    : "border border-white/15 bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                {plan.button}
              </Link>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}