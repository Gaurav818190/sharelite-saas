import Link from "next/link";

const plans = [
  {
    name: "Pro",
    price: "$29",
    period: "/ month",
    description:
      "For freelancers and solo founders starting their outreach journey.",
    features: [
      "4,000 Automated Email sends / month",
      "100 emails per batch",
      "Connect up to 3 Email Inboxes",
      "Standard email validation",
      "Core outreach tools",
    ],
    button: "Choose Pro",
    featured: false,
  },
  {
    name: "Business",
    price: "$49",
    period: "/ month",
    description:
      "For growing agencies and sales teams managing more outreach.",
    features: [
      "20,000 Automated Email sends / month",
      "250 emails per batch",
      "Connect up to 10 Email Inboxes",
      "Lead management tools",
      "Email validation",
      "Campaign tracking and analytics",
    ],
    button: "Choose Business",
    featured: false,
  },
  {
    name: "Scale / Growth",
    price: "$79",
    period: "/ month",
    description:
      "For growing businesses that need higher outreach capacity.",
    features: [
      "30,000 Automated Email sends / month",
      "500 emails per batch",
      "Advanced campaign tools",
      "Lead management and validation",
      "Campaign tracking and analytics",
      "Multiple inbox support",
    ],
    button: "Choose Scale",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "$109",
    period: "/ month",
    description:
      "For larger teams managing high-volume outreach operations.",
    features: [
      "40,000 Automated Email sends / month",
      "1,000 emails per batch",
      "Dedicated IP",
      "Custom Domain",
      "Priority Support",
      "Advanced security and controls",
      "Custom sending limits",
      "Enterprise analytics",
      "Multiple inbox support",
    ],
    button: "Choose Enterprise",
    featured: false,
  },
];

export default function PlansPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-5 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-bold text-slate-300 transition hover:text-purple-300"
          >
            ← Back to Dashboard
          </Link>

          <div className="rounded-full border border-purple-400/40 bg-purple-400/10 px-4 py-2 text-xs font-bold text-purple-300">
            ShareLite Plans
          </div>
        </div>

        <section className="mx-auto mb-12 max-w-3xl text-center">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-purple-400">
            Simple pricing. Powerful outreach.
          </p>

          <h1 className="text-4xl font-black tracking-tight md:text-6xl">
            Choose your ShareLite plan
          </h1>

          <p className="mt-5 text-sm leading-7 text-slate-400 md:text-base">
            Choose the plan that matches your outreach needs.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative flex flex-col rounded-3xl border p-6 transition hover:-translate-y-1 ${
                plan.featured
                  ? "border-amber-400 bg-gradient-to-b from-amber-950/60 via-[#17110a] to-black shadow-2xl shadow-amber-950/40"
                  : "border-purple-400/30 bg-gradient-to-b from-purple-950/20 to-white/[0.02] hover:border-purple-400/70"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-black">
                  Most Popular
                </div>
              )}

              <h2
                className={`text-xl font-black ${
                  plan.featured ? "text-amber-100" : "text-purple-100"
                }`}
              >
                {plan.name}
              </h2>

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
                    <span
                      className={
                        plan.featured
                          ? "text-amber-400"
                          : "text-purple-400"
                      }
                    >
                      ✓
                    </span>

                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/"
                className={`mt-8 block rounded-xl px-4 py-3 text-center text-sm font-black transition hover:scale-[1.02] ${
                  plan.featured
                    ? "bg-gradient-to-r from-amber-500 to-yellow-300 text-black hover:from-amber-400 hover:to-yellow-200"
                    : "border border-purple-400/40 bg-purple-400/10 text-purple-100 hover:bg-purple-400/20"
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