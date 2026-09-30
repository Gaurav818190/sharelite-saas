export type BillingPeriod = "monthly" | "yearly";

export type Currency = "USD" | "INR";

export type PricingPlan = {
  id: string;
  name: string;
  monthlyUsd?: number;
  yearlyUsd?: number;
  annualOnly?: boolean;
};

export const USD_TO_INR_RATE = 95.95;

/**
 * ShareLite pricing source of truth.
 *
 * International users:
 * USD prices
 *
 * Indian users:
 * INR prices calculated server-side.
 */
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "pro",
    name: "Pro",
    monthlyUsd: 29,
    yearlyUsd: 290,
  },
  {
    id: "business",
    name: "Business",
    monthlyUsd: 49,
    yearlyUsd: 470,
  },
  {
    id: "scale",
    name: "Scale",
    monthlyUsd: 79,
    yearlyUsd: 750,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyUsd: 109,
    yearlyUsd: 1050,
  },
  {
    id: "yearly_unlimited",
    name: "Yearly Unlimited",
    yearlyUsd: 2499,
    annualOnly: true,
  },
  {
    id: "ultimate_growth",
    name: "Ultimate Growth Agency & Enterprise Scale",
    yearlyUsd: 3199,
    annualOnly: true,
  },
];

/**
 * India pricing rule:
 * Convert USD → INR, round upward,
 * then use psychological pricing ending in 9.
 */
export function usdToInr(usd: number): number {
  const converted = Math.ceil(usd * USD_TO_INR_RATE);
  const remainder = converted % 10;

  if (remainder === 9) {
    return converted;
  }

  return converted + (9 - remainder + 10) % 10;
}

export function getPlanPrice(
  plan: PricingPlan,
  billing: BillingPeriod,
  currency: Currency,
): number | null {
  const usdPrice =
    billing === "monthly"
      ? plan.monthlyUsd
      : plan.yearlyUsd;

  if (usdPrice === undefined) {
    return null;
  }

  if (currency === "INR") {
    return usdToInr(usdPrice);
  }

  return usdPrice;
}

export function formatPrice(
  amount: number,
  currency: Currency,
): string {
  if (currency === "INR") {
    return `₹${amount.toLocaleString("en-IN")}`;
  }

  return `$${amount.toLocaleString("en-US")}`;
}

/**
 * Country → billing currency.
 *
 * India = INR
 * Every other country = USD
 */
export function currencyForCountry(
  country: string,
): Currency {
  return country.trim().toLowerCase() === "india"
    ? "INR"
    : "USD";
}

/**
 * Free account trial.
 */
export const FREE_TRIAL_DAYS = 12;

/**
 * One-month Limit Boost.
 *
 * This does NOT increase the user's plan limits.
 * It does NOT add extra AI, email, lead, or validation credits.
 * It only extends the user's existing plan period by one month.
 */
export const LIMIT_BOOST_USD = 10;

export function getLimitBoostPrice(
  currency: Currency,
): number {
  if (currency === "INR") {
    return usdToInr(LIMIT_BOOST_USD);
  }

  return LIMIT_BOOST_USD;
}

export function formatLimitBoostPrice(
  currency: Currency,
): string {
  return formatPrice(
    getLimitBoostPrice(currency),
    currency,
  );
}