"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import type { AuthUser } from "@/lib/supabase-auth";


import type {
  Lead,
  LeadCounts,
  LeadStatus,
} from "@/lib/supabase-db";

import type {
  Campaign,
  Template,
} from "@/lib/supabase-workspaces";

import WorkspacePanels from "./WorkspacePanels";
import ReviewsPanel from "./ReviewsPanel";
import GeoAnalytics from "./GeoAnalytics";

type DashboardConnectedInbox = {
  id: string;
  email: string;
  display_name: string | null;
  provider: string;
  status: string;
};

type DashboardClientProps = {
  user: AuthUser;
  initialLeads: Lead[];
  initialCounts: LeadCounts;
  dataError?: string;
};

type AnalyticsRange = "7d" | "30d" | "3m";

type DeliveryLifecycle = {
  pending: number;
  sending: number;
  accepted: number;
  delivered: number;
  bounced: number;
  failed: number;
  total: number;
  deliveryRate: number;
  bounceRate: number;
};

type DashboardDelivery = {
  id: string;
  campaign_id: string;
  lead_id?: string;
  status?: string;
  sent_at?: string | null;
  delivered_at?: string | null;
  bounced_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function DashboardIcon({
  name,
  size = 19,
}: {
  name: string;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "dashboard") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }

  if (name === "leads") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3.5 20c.5-3.2 2.4-5 5.5-5s5 1.8 5.5 5" />
        <path d="M14 15.5c2.9-.3 5.2 1.2 6 4.5" />
      </svg>
    );
  }

  if (name === "campaigns") {
    return (
      <svg {...common}>
        <path d="M4 11.5 20 4l-5 16-3.5-6-7.5-2.5Z" />
        <path d="m11.5 14 4.5-4.5" />
      </svg>
    );
  }

  if (name === "messages") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  }

  if (name === "approvals") {
    return (
      <svg {...common}>
        <path d="M12 3 20 6v5c0 5.2-3.3 8.4-8 10-4.7-1.6-8-4.8-8-10V6l8-3Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </svg>
    );
  }

  if (name === "analytics") {
    return (
      <svg {...common}>
        <path d="M4 20V11" />
        <path d="M10 20V5" />
        <path d="M16 20v-8" />
        <path d="M22 20V3" />
      </svg>
    );
  }

    if (name === "geo") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17" />
        <path d="M12 3.5c2.2 2.3 3.4 5.1 3.4 8.5s-1.2 6.2-3.4 8.5c-2.2-2.3-3.4-5.1-3.4-8.5s1.2-6.2 3.4-8.5Z" />
        <path d="M5.5 7.5c1.9 1 4.1 1.5 6.5 1.5s4.6-.5 6.5-1.5" />
        <path d="M5.5 16.5c1.9-1 4.1-1.5 6.5-1.5s4.6.5 6.5 1.5" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.6V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.6-1H6v-2.6h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V5h2.6v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2V14h-.2a1.7 1.7 0 0 0-1.6 1Z" />
      </svg>
    );
  }

  if (name === "billing") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 15h4" />
      </svg>
    );
  }

  if (name === "x") {
    return (
      <svg {...common}>
        <path d="m7 7 10 10" />
        <path d="m17 7-10 10" />
      </svg>
    );
  }

  return null;
}

const emptyLead = {
  name: "",
  email: "",
  company: "",
  website: "",
  status: "new" as LeadStatus,
  source: "",
  country_code: "",
  country_name: "",
};

function getFirstName(user: AuthUser): string {
  const rawUser = user as AuthUser & {
    email?: string;
    user_metadata?: {
      name?: string;
      full_name?: string;
      first_name?: string;
    };
  };

  const metadata = rawUser.user_metadata;

  const savedName =
    metadata?.name ||
    metadata?.full_name ||
    metadata?.first_name ||
    "";

  const emailName = rawUser.email?.split("@")[0] || "";

  const nameToUse = String(savedName || emailName || "User")
    .trim()
    .replace(/[._-]+/g, " ");

  const firstName = nameToUse.split(/\s+/)[0];

  if (!firstName) {
    return "User";
  }

  return (
    firstName.charAt(0).toUpperCase() +
    firstName.slice(1).toLowerCase()
  );
}

export default function DashboardClient({
  user,
  initialLeads,
  initialCounts,
  dataError,
}: DashboardClientProps) {
  const dark = false;
  const [activeTab, setActiveTab] = useState("dashboard");

     const [leads, setLeads] = useState<Lead[]>(initialLeads);

  const initialValidCount = initialLeads.filter(
    (lead) => lead.validation_status === "valid"
  ).length;

  const [counts, setCounts] = useState<LeadCounts>({
    ...initialCounts,
    total: initialLeads.length,
    valid: initialValidCount,
  });

  const [changes, setChanges] = useState({
    total: null as number | null,
    valid: null as number | null,
    contacted: null as number | null,
    converted: null as number | null,
  });

  const [leadForm, setLeadForm] = useState(emptyLead);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const [pending, setPending] = useState(false);

  const [aiMessages, setAiMessages] = useState<Record<string, string>>(
    {}
  );
  const [aiSubjects, setAiSubjects] = useState<Record<string, string>>(
  {}
);
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [outreachTemplates, setOutreachTemplates] = useState<Template[]>(
  []
);

const [selectedTemplateIds, setSelectedTemplateIds] = useState<
  Record<string, string>
>({});

const [outreachMessages, setOutreachMessages] = useState<
  Record<string, string>
>({});

const [outreachSubjects, setOutreachSubjects] = useState<
  Record<string, string>
>({});

const [templatesLoading, setTemplatesLoading] = useState(false);
const [templatesError, setTemplatesError] = useState<string | null>(
  null
);

const [campaigns, setCampaigns] = useState<Campaign[]>([]);
const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
const [connectedInboxes, setConnectedInboxes] = useState<
  DashboardConnectedInbox[]
>([]);
const [dashboardDeliveries, setDashboardDeliveries] = useState<DashboardDelivery[]>([]);
const [dashboardCampaignLoading, setDashboardCampaignLoading] = useState(false);
const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
const [selectedCampaignId, setSelectedCampaignId] = useState("");
const [bulkOutreachLoading, setBulkOutreachLoading] = useState(false);
const [bulkOutreachMessage, setBulkOutreachMessage] = useState<
  string | null
>(null);
const [bulkOutreachError, setBulkOutreachError] = useState<string | null>(
  null
);
const [prepagrayDeliveryIds, setPrepagrayDeliveryIds] = useState<string[]>([]);
const [sendDeliveryLoading, setSendDeliveryLoading] = useState(false);
  const [analyticsRange, setAnalyticsRange] =
    useState<AnalyticsRange>("7d");

  const [deliveryLifecycle, setDeliveryLifecycle] =
  useState<DeliveryLifecycle>({
    pending: 0,
    sending: 0,
    accepted: 0,
    delivered: 0,
    bounced: 0,
    failed: 0,
    total: 0,
    deliveryRate: 0,
    bounceRate: 0,
  });
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  const [trialSeconds, setTrialSeconds] = useState<number | null>(null);
  const [permanentFree, setPermanentFree] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

    const [plan, setPlan] = useState<
    "free"
    | "pro"
    | "business"
    | "scale"
    | "enterprise"
    | "yearly_unlimited"
    | "ultimate_growth"
  >("free"); 

  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(
    null
  );

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [geoUpgradeOpen, setGeoUpgradeOpen] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState("");
  
  const firstName =
  profileFirstName.trim() || getFirstName(user);

    const navGroups = [
    {
      title: "WORKSPACE",
      items: [
        { id: "dashboard", label: "Dashboard", icon: "dashboard" },
        { id: "leads", label: "Leads", icon: "leads" },
        { id: "campaigns", label: "Campaigns", icon: "campaigns" },
        { id: "messages", label: "Messages", icon: "messages" },
        { id: "approvals", label: "Approvals", icon: "approvals" },
        { id: "analytics", label: "Analytics", icon: "analytics" },
        { id: "geo-analytics", label: "Geo Analytics", icon: "geo" },
      ],
    },
    {
      title: "MANAGE",
      items: [
        { id: "templates", label: "Templates", icon: "templates" },
        {
          id: "inboxes",
          label: "Connected Inboxes",
          icon: "inboxes",
        },
        { id: "reviews", label: "Reviews", icon: "reviews" },
      ],
    },
    {
      title: "ACCOUNT",
      items: [
        { id: "billing", label: "Billing", icon: "billing" },
        { id: "settings", label: "Settings", icon: "settings" },
      ],
    },
  ];

  function formatStatChange(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "No previous data";
  }

  const rounded = Math.round(value * 10) / 10;

  if (rounded > 0) {
    return `↑ +${rounded}% vs previous period`;
  }

  if (rounded < 0) {
    return `↓ ${rounded}% vs previous period`;
  }

  return "• 0% vs previous period";
}

      const stats = [
    {
      label: "Total Leads",
      value: counts.total.toLocaleString(),
      change:
        changes.total === null
          ? "No previous data"
          : `${changes.total > 0 ? "↑ +" : changes.total < 0 ? "↓ " : "• "}${Math.round(
              changes.total * 10
            ) / 10}% vs previous period`,
    },
    {
      label: "Valid Leads",
      value: counts.valid.toLocaleString(),
      change:
        changes.valid === null
          ? "No previous data"
          : `${changes.valid > 0 ? "↑ +" : changes.valid < 0 ? "↓ " : "• "}${Math.round(
              changes.valid * 10
            ) / 10}% vs previous period`,
    },
    {
      label: "Contacted",
      value: counts.contacted.toLocaleString(),
      change:
        changes.contacted === null
          ? "No previous data"
          : `${changes.contacted > 0 ? "↑ +" : changes.contacted < 0 ? "↓ " : "• "}${Math.round(
              changes.contacted * 10
            ) / 10}% vs previous period`,
    },
    {
      label: "Converted",
      value: counts.converted.toLocaleString(),
      change:
        changes.converted === null
          ? "No previous data"
          : `${changes.converted > 0 ? "↑ +" : changes.converted < 0 ? "↓ " : "• "}${Math.round(
              changes.converted * 10
            ) / 10}% vs previous period`,
    },
  ];
  const leadRows = useMemo(() => leads, [leads]);

  const invalidLeadCount = leads.filter(
    (lead) => lead.validation_status === "invalid"
  ).length;

  const emailsSentCount = dashboardDeliveries.filter((delivery) => {
    const status = String(delivery.status ?? "").toLowerCase();
    return Boolean(
      delivery.sent_at ||
        ["sending", "accepted", "delivered", "bounced", "failed"].includes(status)
    );
  }).length;

  const campaignStatus = {
    active: campaigns.filter((campaign) => campaign.status === "active").length,
    completed: campaigns.filter((campaign) => campaign.status === "completed").length,
    draft: campaigns.filter((campaign) => campaign.status === "draft").length,
    paused: campaigns.filter((campaign) => campaign.status === "paused").length,
  };

  const campaignStatusTotal =
    campaignStatus.active +
    campaignStatus.completed +
    campaignStatus.draft +
    campaignStatus.paused;

  const recentCampaigns = campaigns.slice(0, 3);

  const pendingApprovals = leads
    .filter((lead) => lead.status === "new")
    .slice(0, 3);

  const trialDays =
    trialSeconds === null
      ? null
      : Math.floor(trialSeconds / 86400);
  const trialHours =
    trialSeconds === null
      ? null
      : Math.floor((trialSeconds % 86400) / 3600);
  const trialMinutes =
    trialSeconds === null
      ? null
      : Math.floor((trialSeconds % 3600) / 60);

  const trialCountdown =
    trialSeconds === null
      ? "--D --hr --sec"
      : `${trialDays}D ${String(trialHours).padStart(2, "0")}hr ${String(
          trialSeconds % 60
        ).padStart(2, "0")}sec`;

  function relativeTime(value?: string | null): string {
    if (!value) return "—";
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return "—";
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function campaignDeliveryStats(campaignId: string) {
    const rows = dashboardDeliveries.filter(
      (delivery) => delivery.campaign_id === campaignId
    );
    const sent = rows.filter((delivery) => {
      const status = String(delivery.status ?? "").toLowerCase();
      return Boolean(
        delivery.sent_at ||
          ["sending", "accepted", "delivered", "bounced", "failed"].includes(status)
      );
    }).length;
    const delivered = rows.filter(
      (delivery) =>
        String(delivery.status ?? "").toLowerCase() === "delivered" ||
        Boolean(delivery.delivered_at)
    ).length;
    const failed = rows.filter((delivery) => {
      const status = String(delivery.status ?? "").toLowerCase();
      return status === "failed" || status === "bounced" || Boolean(delivery.bounced_at);
    }).length;
    return { sent, delivered, failed };
  }

  const countdown =
    trialSeconds === null
      ? "-- : -- : --"
      : `${String(Math.floor(trialSeconds / 3600)).padStart(
          2,
          "0"
        )} : ${String(
          Math.floor((trialSeconds % 3600) / 60)
        ).padStart(2, "0")} : ${String(trialSeconds % 60).padStart(
          2,
          "0"
        )}`;

  async function refreshLeads() {
    const response = await fetch("/api/leads", {
      cache: "no-store",
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(body?.error ?? "Unable to load leads.");
    }

    const freshLeads: Lead[] = Array.isArray(body?.leads)
  ? body.leads
  : [];

setLeads(freshLeads);

const apiCounts = body?.counts ?? {
  total: 0,
  valid: 0,
  contacted: 0,
  converted: 0,
};

setCounts({
  ...apiCounts,
  total: freshLeads.length,
  valid: freshLeads.filter(
    (lead) => lead.validation_status === "valid"
  ).length,
});
  }
  async function loadDashboardCampaignData() {
    setDashboardCampaignLoading(true);

    try {
      const response = await fetch("/api/campaigns", {
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to load campaigns.");
      }

      const loadedCampaigns = Array.isArray(body?.campaigns)
        ? (body.campaigns as Campaign[])
        : [];

      setCampaigns(loadedCampaigns);

      const deliveryGroups = await Promise.all(
        loadedCampaigns.map(async (campaign) => {
          try {
            const deliveryResponse = await fetch(
              `/api/campaigns/${encodeURIComponent(campaign.id)}/deliveries`,
              { cache: "no-store" }
            );
            const deliveryBody = await deliveryResponse.json().catch(() => null);
            return deliveryResponse.ok && Array.isArray(deliveryBody?.deliveries)
              ? (deliveryBody.deliveries as DashboardDelivery[])
              : [];
          } catch {
            return [];
          }
        })
      );

      setDashboardDeliveries(deliveryGroups.flat());
    } catch (error) {
      setRefreshError(
        error instanceof Error
          ? error.message
          : "Unable to load campaign data."
      );
    } finally {
      setDashboardCampaignLoading(false);
    }
  }

  async function refreshDashboard() {
    setRefreshing(true);
    setRefreshError(null);

    try {
      const [
        leadsResponse,
        analyticsResponse,
        subscriptionResponse,
      ] = await Promise.all([
        fetch("/api/leads", { cache: "no-store" }),
        fetch(`/api/analytics?range=${analyticsRange}`, {
          cache: "no-store",
        }),
        fetch("/api/subscription", { cache: "no-store" }),
      ]);

      const [
        leadsBody,
        analyticsBody,
        subscriptionBody,
      ] = await Promise.all([
        leadsResponse.json().catch(() => null),
        analyticsResponse.json().catch(() => null),
        subscriptionResponse.json().catch(() => null),
      ]);

      if (!leadsResponse.ok) {
        throw new Error(
          leadsBody?.error ?? "Unable to load dashboard data."
        );
      }

      setLeads(Array.isArray(leadsBody?.leads) ? leadsBody.leads : []);

      setCounts(
        leadsBody?.counts ?? {
          total: 0,
          valid: 0,
          contacted: 0,
          converted: 0,
        }
      );

      if (activeTab === "dashboard") {
        void loadDashboardCampaignData();
      }

if (
  analyticsResponse.ok &&
  analyticsBody?.deliveryLifecycle
) {
  setDeliveryLifecycle(
    analyticsBody.deliveryLifecycle,
  );
}
  

      if (analyticsResponse.ok) {
  setChanges({
    total:
      typeof analyticsBody?.changes?.total?.percentage === "number"
        ? analyticsBody.changes.total.percentage
        : null,
    valid:
      typeof analyticsBody?.changes?.valid?.percentage === "number"
        ? analyticsBody.changes.valid.percentage
        : null,
    contacted:
      typeof analyticsBody?.changes?.contacted?.percentage === "number"
        ? analyticsBody.changes.contacted.percentage
        : null,
    converted:
      typeof analyticsBody?.changes?.converted?.percentage === "number"
        ? analyticsBody.changes.converted.percentage
        : null,
  });
}

const isPermanentFree = Boolean(subscriptionBody?.permanentFree);

setPermanentFree(isPermanentFree);

if (isPermanentFree) {
  setTrialEndsAt(null);
  setTrialSeconds(null);
} else {
  const end =
    subscriptionBody?.trialEndsAt ??
    subscriptionBody?.subscription?.current_period_end;

  if (
    typeof end === "string" &&
    Number.isFinite(new Date(end).getTime())
  ) {
    setTrialEndsAt(end);
  } else {
    setTrialEndsAt(null);
  }
}


      if (subscriptionResponse.ok) {
        const nextPlan = subscriptionBody?.plan ?? subscriptionBody?.subscription?.plan;
        if (typeof nextPlan === "string" && nextPlan.trim()) {
          const normalizedPlan = nextPlan.trim().toLowerCase() as typeof plan;
          if (["free", "pro", "business", "scale", "enterprise", "yearly_unlimited", "ultimate_growth"].includes(normalizedPlan)) {
            setPlan(normalizedPlan);
          }
        }

        const end =
          subscriptionBody?.trialEndsAt ??
          subscriptionBody?.subscription?.current_period_end;

        if (
          typeof end === "string" &&
          Number.isFinite(new Date(end).getTime())
        ) {
          setTrialEndsAt(end);
        }
      }
    } catch (error) {
      setRefreshError(
        error instanceof Error
          ? error.message
          : "Unable to refresh dashboard."
      );
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const inboxStatus = params.get("inbox");

  if (inboxStatus === "google_connected") {
    setActiveTab("inbox");

    window.history.replaceState(
      {},
      "",
      window.location.pathname
    );
  }
}, []);

  useEffect(() => {
  let cancelled = false;

  async function loadConnectedInboxes() {
    try {
      const response = await fetch("/api/inboxes", {
        cache: "no-store",
      });

      const body = await response.json().catch(() => null);

      if (!response.ok || cancelled) {
        return;
      }

      const inboxes = Array.isArray(body?.inboxes)
        ? (body.inboxes as DashboardConnectedInbox[])
        : [];

      setConnectedInboxes(inboxes);

      const activeGoogleInboxes = inboxes.filter(
        (inbox) =>
          inbox.provider === "google" &&
          inbox.status === "active"
      );

      setSelectedInboxId((current) => {
        if (
          current &&
          activeGoogleInboxes.some(
            (inbox) => inbox.id === current
          )
        ) {
          return current;
        }

        return activeGoogleInboxes[0]?.id ?? null;
      });
    } catch {
      if (!cancelled) {
        setConnectedInboxes([]);
      }
    }
  }

  void loadConnectedInboxes();

  return () => {
    cancelled = true;
  };
}, []);

  useEffect(() => {
    let cancelled = false;

    async function loadExtras() {
      const [
        analyticsResponse,
        subscriptionResponse,
      ] = await Promise.all([
        fetch(`/api/analytics?range=${analyticsRange}`, {
          cache: "no-store",
        }),
        fetch("/api/subscription", {
          cache: "no-store",
        }),
      ]);

      const analyticsBody = await analyticsResponse
        .json()
        .catch(() => null);

      const subscriptionBody = await subscriptionResponse
        .json()
        .catch(() => null);

 
if (
  !cancelled &&
  analyticsResponse.ok &&
  analyticsBody?.deliveryLifecycle
) {
  setDeliveryLifecycle(
    analyticsBody.deliveryLifecycle,
  );
}
const isPermanentFree = Boolean(subscriptionBody?.permanentFree);

setPermanentFree(isPermanentFree);

if (isPermanentFree) {
  setTrialEndsAt(null);
  setTrialSeconds(null);
} else {
  const end =
    subscriptionBody?.trialEndsAt ??
    subscriptionBody?.subscription?.current_period_end;

  if (
    typeof end === "string" &&
    Number.isFinite(new Date(end).getTime())
  ) {
    setTrialEndsAt(end);
  } else {
    setTrialEndsAt(null);
  }
}

      if (!cancelled && subscriptionResponse.ok) {
        const nextPlan = subscriptionBody?.plan ?? subscriptionBody?.subscription?.plan;
        if (typeof nextPlan === "string" && nextPlan.trim()) {
          const normalizedPlan = nextPlan.trim().toLowerCase() as typeof plan;
          if (["free", "pro", "business", "scale", "enterprise", "yearly_unlimited", "ultimate_growth"].includes(normalizedPlan)) {
            setPlan(normalizedPlan);
          }
        }

        const end =
          subscriptionBody?.trialEndsAt ??
          subscriptionBody?.subscription?.current_period_end;

        if (
          typeof end === "string" &&
          Number.isFinite(new Date(end).getTime())
        ) {
          setTrialEndsAt(end);
        }
      }
    }

    void loadExtras();

    return () => {
      cancelled = true;
    };
  }, [analyticsRange]);

  useEffect(() => {
  let cancelled = false;

  async function loadProfileName() {
    try {
      const response = await fetch("/api/profile", {
        cache: "no-store",
      });

      const body = await response.json().catch(() => null);

      if (!response.ok || cancelled) {
        return;
      }

      const profile = body?.profile;

      const savedName =
        typeof profile?.first_name === "string"
          ? profile.first_name.trim()
          : typeof profile?.name === "string"
          ? profile.name.trim()
          : "";

      if (savedName) {
        const formattedName = savedName
          .replace(/[._-]+/g, " ")
          .trim()
          .split(/\s+/)[0];

        setProfileFirstName(
          formattedName.charAt(0).toUpperCase() +
            formattedName.slice(1).toLowerCase()
        );
      }
    } catch {
      // Fallback to auth metadata name.
    }
  }

  void loadProfileName();

  return () => {
    cancelled = true;
  };
}, []);
  useEffect(() => {
  function handleProfileUpdated(event: Event) {
    const customEvent = event as CustomEvent<{
      firstName?: string;
    }>;

    const updatedName =
      typeof customEvent.detail?.firstName === "string"
        ? customEvent.detail.firstName.trim()
        : "";

    if (!updatedName) {
      return;
    }

    setProfileFirstName(
      updatedName.charAt(0).toUpperCase() +
        updatedName.slice(1).toLowerCase()
    );
  }

  window.addEventListener(
    "sharelite-profile-updated",
    handleProfileUpdated
  );

  return () => {
    window.removeEventListener(
      "sharelite-profile-updated",
      handleProfileUpdated
    );
  };
}, []);
  useEffect(() => {
  if (activeTab !== "leads") {
    return;
  }

  let cancelled = false;

  async function loadOutreachTemplates() {
    setTemplatesLoading(true);
    setTemplatesError(null);

    try {
      const response = await fetch("/api/templates", {
        cache: "no-store",
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.error ?? "Unable to load outreach templates."
        );
      }

      if (!cancelled) {
        setOutreachTemplates(
          Array.isArray(body?.templates) ? body.templates : []
        );
      }
    } catch (error) {
      if (!cancelled) {
        setTemplatesError(
          error instanceof Error
            ? error.message
            : "Unable to load outreach templates."
        );
      }
    } finally {
      if (!cancelled) {
        setTemplatesLoading(false);
      }
    }
  }

  void loadOutreachTemplates();

  return () => {
    cancelled = true;
  };
}, [activeTab]);

useEffect(() => {
  if (activeTab !== "dashboard" && activeTab !== "leads") {
    return;
  }

  if (activeTab === "dashboard") {
    void loadDashboardCampaignData();
    return;
  }

  let cancelled = false;

  async function loadCampaigns() {
    setBulkOutreachError(null);

    try {
      const response = await fetch("/api/campaigns", {
        cache: "no-store",
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to load campaigns.");
      }

      if (!cancelled) {
        setCampaigns(Array.isArray(body?.campaigns) ? body.campaigns : []);
      }
    } catch (error) {
      if (!cancelled) {
        setBulkOutreachError(
          error instanceof Error
            ? error.message
            : "Unable to load campaigns."
        );
      }
    }
  }

  void loadCampaigns();

  return () => {
    cancelled = true;
  };
}, [activeTab]);

useEffect(() => {
  if (
    activeTab !== "leads" ||
    !selectedCampaignId
  ) {
    return;
  }

  let cancelled = false;

  async function loadPrepagrayDeliveries() {
    try {
      const response = await fetch(
        `/api/campaigns/${encodeURIComponent(
          selectedCampaignId,
        )}/deliveries`,
        {
          cache: "no-store",
        },
      );

      const body =
        await response.json().catch(() => null);

      if (
        !response.ok ||
        cancelled
      ) {
        return;
      }

      const deliveries = Array.isArray(
        body?.deliveries,
      )
        ? body.deliveries
        : [];

      const pendingDeliveries =
        deliveries.filter(
          (delivery: {
            status?: string;
          }) =>
            delivery?.status === "pending",
        );

      setPrepagrayDeliveryIds(
        pendingDeliveries
          .map(
            (delivery: {
              id?: string;
            }) =>
              typeof delivery?.id === "string"
                ? delivery.id
                : null,
          )
          .filter(
            (
              id: string | null,
            ): id is string =>
              Boolean(id),
          ),
      );

      for (const delivery of pendingDeliveries) {
        const leadId =
          typeof delivery?.lead_id === "string"
            ? delivery.lead_id
            : "";

        const subject =
          typeof delivery?.email_subject === "string"
            ? delivery.email_subject.trim()
            : "";

        const message =
          typeof delivery?.email_body === "string"
            ? delivery.email_body.trim()
            : "";

        if (
          !leadId ||
          !subject ||
          !message
        ) {
          continue;
        }

        setAiSubjects((current) => ({
          ...current,
          [leadId]: subject,
        }));

        setAiMessages((current) => ({
          ...current,
          [leadId]: message,
        }));
      }
    } catch {
      // Keep the local AI draft if loading fails.
    }
  }

  void loadPrepagrayDeliveries();

  return () => {
    cancelled = true;
  };
}, [activeTab, selectedCampaignId]);

  useEffect(() => {
    if (!trialEndsAt) {
      return;
    }

    const updateCountdown = () => {
      const seconds = Math.max(
        0,
        Math.ceil(
          (new Date(trialEndsAt).getTime() - Date.now()) / 1000
        )
      );

      setTrialSeconds(seconds);
    };

    updateCountdown();

    const interval = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(interval);
  }, [trialEndsAt]);

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLeadError(null);

    const company = leadForm.company.trim();

    if (!company) {
      setLeadError("Company name is required.");
      return;
    }

    setPending(true);

    try {
      const response = await fetch(
        editingId ? `/api/leads/${editingId}` : "/api/leads",
        {
          method: editingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...leadForm,
            company,
          }),
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to save lead.");
      }

      await refreshLeads();

      setLeadForm(emptyLead);
      setEditingId(null);
    } catch (error) {
      setLeadError(
        error instanceof Error
          ? error.message
          : "Unable to save lead."
      );
    } finally {
      setPending(false);
    }
  }

  function editLead(lead: Lead) {
    setEditingId(lead.id);

    setLeadForm({
  name: lead.name,
  email: lead.email,
  company: lead.company ?? "",
  website: lead.website ?? "",
  status: lead.status,
  source: lead.source ?? "",
  country_code: lead.country_code ?? "",
  country_name: lead.country_name ?? "",
});

    setActiveTab("leads");
  }

  async function removeLead(id: string) {
    setLeadError(null);

    const response = await fetch(`/api/leads/${id}`, {
      method: "DELETE",
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setLeadError(body?.error ?? "Unable to delete lead.");
      return;
    }

    setAiMessages((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });

    setAiSubjects((current) => {
  const next = { ...current };
  delete next[id];
  return next;
});

    await refreshLeads();
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setImporting(true);
    setImportSummary(null);
    setLeadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/leads/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "CSV import failed.");
      }

      setImportSummary(
        `Imported: ${data.imported}, Invalid: ${data.invalid}, Duplicates: ${data.duplicates}, Skipped by limit: ${data.skippedByLimit}`
      );

      await refreshLeads();
    } catch (error) {
      setLeadError(
        error instanceof Error
          ? error.message
          : "CSV import failed."
      );
    } finally {
      setImporting(false);

      if (csvInputRef.current) {
        csvInputRef.current.value = "";
      }
    }
  }

  function downloadCsvTemplate() {
  const csvContent =
    "name,email,company,website,country_code,country_name\n" +
    "John Doe,john@example.com,Example Company,https://example.com,IN,India\n";

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "sharelite-leads-template.csv";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

  async function validateLead(id: string) {
  setLeadError(null);
  setPending(true);

  try {
    const response = await fetch(`/api/leads/${id}/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        body?.error ?? "Unable to validate email."
      );
    }

    const updatedLead = body?.lead;

    if (updatedLead && typeof updatedLead.id === "string") {
      setLeads((currentLeads) =>
        currentLeads.map((lead) =>
          lead.id === updatedLead.id
            ? {
                ...lead,
                ...updatedLead,
              }
            : lead
        )
      );
    }

    await refreshLeads();

    if (body?.message) {
      setLeadError(null);
    }
  } catch (error) {
    setLeadError(
      error instanceof Error
        ? error.message
        : "Unable to validate email."
    );
  } finally {
    setPending(false);
  }
}
  async function generateAiMessage(id: string) {
  setLeadError(null);
  setAiLoadingId(id);

  try {
    const lead = leads.find((item) => item.id === id);

    if (!lead) {
      throw new Error("Lead not found.");
    }

    if (lead.validation_status !== "valid") {
      setLeadError(
        "Validate this lead first. Only valid email leads can use AI outreach.",
      );
      return;
    }

    const response = await fetch(`/api/leads/${id}/ai-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        goal: "Introduce ShareLite and start a relevant business conversation",
        tone: "professional",
        instructions:
          "Write a natural, specific B2B outreach email. Avoid generic praise and avoid inventing facts.",
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setLeadError(
        body?.error ?? "Unable to generate AI message.",
      );
      return;
    }

    const generatedSubject =
      typeof body?.subject === "string"
        ? body.subject.trim()
        : "";

    const generatedMessage =
      typeof body?.message === "string"
        ? body.message.trim()
        : "";

    if (!generatedSubject || !generatedMessage) {
      setLeadError(
        "AI returned an incomplete email. Please try again.",
      );
      return;
    }

    setAiSubjects((current) => ({
      ...current,
      [id]: generatedSubject,
    }));

    setAiMessages((current) => ({
      ...current,
      [id]: generatedMessage,
    }));
  } catch (error) {
    setLeadError(
      error instanceof Error
        ? error.message
        : "Unable to generate AI message.",
    );
  } finally {
    setAiLoadingId(null);
  }
}
  async function copyAiMessage(id: string) {
    const message = aiMessages[id];

    if (!message) {
      return;
    }

    try {
      await navigator.clipboard.writeText(message);
    } catch {
      setLeadError(
        "Copy failed. Please select the message and copy it manually."
      );
    }
  }
  function personalizeTemplate(
  text: string,
  lead: Lead
): string {
  const fullName = lead.name.trim();
  const firstName =
    fullName.split(/\s+/)[0] || "there";

  return text
    .replace(/\[First Name\]/gi, firstName)
    .replace(/\[Name\]/gi, fullName || "there")
    .replace(/\[Company\]/gi, lead.company ?? "your company")
    .replace(/\[Email\]/gi, lead.email)
    .replace(/\[Website\]/gi, lead.website ?? "");
}

function applyOutreachTemplate(
  lead: Lead,
  templateId: string
) {
  const template = outreachTemplates.find(
    (item) => item.id === templateId
  );

  if (!template) {
    return;
  }

  setSelectedTemplateIds((current) => ({
    ...current,
    [lead.id]: templateId,
  }));

  setOutreachSubjects((current) => ({
    ...current,
    [lead.id]: personalizeTemplate(template.subject, lead),
  }));

  setOutreachMessages((current) => ({
    ...current,
    [lead.id]: personalizeTemplate(template.body, lead),
  }));
}

async function copyOutreachMessage(id: string) {
  const subject = outreachSubjects[id] ?? "";
  const message = outreachMessages[id] ?? "";

  if (!message.trim()) {
    return;
  }

  const content = subject.trim()
    ? `Subject: ${subject}\n\n${message}`
    : message;

  try {
    await navigator.clipboard.writeText(content);
  } catch {
    setLeadError(
      "Copy failed. Please select the message and copy it manually."
    );
  }
}
function toggleLeadSelection(id: string) {
  setSelectedLeadIds((current) =>
    current.includes(id)
      ? current.filter((leadId) => leadId !== id)
      : [...current, id]
  );
}

function selectAllLeads() {
  setSelectedLeadIds(
    leadRows.map((lead) => lead.id)
  );
}

function clearSelectedLeads() {
  setSelectedLeadIds([]);
}

async function prepareBulkCampaign() {
  setBulkOutreachError(null);
  setBulkOutreachMessage(null);

  if (!selectedCampaignId) {
    setBulkOutreachError(
      "Please select a campaign.",
    );
    return;
  }

  if (selectedLeadIds.length === 0) {
    setBulkOutreachError(
      "Please select at least one lead.",
    );
    return;
  }

  const aiDrafts: Record<
    string,
    {
      subject: string;
      message: string;
    }
  > = {};

  for (const leadId of selectedLeadIds) {
    const subject =
      typeof aiSubjects[leadId] === "string"
        ? aiSubjects[leadId].trim()
        : "";

    const message =
      typeof aiMessages[leadId] === "string"
        ? aiMessages[leadId].trim()
        : "";

    if (subject && message) {
      aiDrafts[leadId] = {
        subject,
        message,
      };
    }
  }

  setBulkOutreachLoading(true);

  try { const response = await fetch(
      `/api/campaigns/${encodeURIComponent(
        selectedCampaignId,
      )}/deliveries`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          aiDrafts,
        }),
      },
    );

    const body =
      await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        body?.error ??
          "Unable to prepare campaign deliveries.",
      );
    }

    const prepagrayDeliveries =
      Array.isArray(body?.prepagrayDeliveries)
        ? body.prepagrayDeliveries
        : [];

    setPrepagrayDeliveryIds(
      prepagrayDeliveries
        .map(
          (delivery: { id?: string }) =>
            typeof delivery?.id === "string"
              ? delivery.id
              : null,
        )
        .filter(
          (id: string | null): id is string =>
            Boolean(id),
        ),
    );

    setBulkOutreachMessage(
      `Campaign prepagray: ${
        prepagrayDeliveries.length
      } delivery(s) ready.`,
    );

    setSelectedLeadIds([]);
  } catch (error) {
    setBulkOutreachError(
      error instanceof Error
        ? error.message
        : "Unable to prepare campaign deliveries.",
    );
  } finally {
    setBulkOutreachLoading(false);
  }
}
 async function sendPrepagrayDelivery() {
  setBulkOutreachError(null);
  setBulkOutreachMessage(null);

  if (!selectedCampaignId) {
    setBulkOutreachError(
      "Please select a campaign first.",
    );
    return;
  }

  if (!selectedInboxId) {
    setBulkOutreachError(
      "Please select a Gmail inbox before sending.",
    );
    return;
  }

  if (prepagrayDeliveryIds.length === 0) {
    setBulkOutreachError(
      "No prepagray deliveries are available.",
    );
    return;
  }

  setSendDeliveryLoading(true);

  try {
    const deliveriesResponse = await fetch(
      `/api/campaigns/${encodeURIComponent(
        selectedCampaignId,
      )}/deliveries`,
      {
        method: "GET",
        cache: "no-store",
      },
    );

    const deliveriesBody =
      await deliveriesResponse.json().catch(() => null);

    if (!deliveriesResponse.ok) {
      throw new Error(
        deliveriesBody?.error ??
          "Unable to load prepagray deliveries.",
      );
    }

    const deliveries = Array.isArray(
      deliveriesBody?.deliveries,
    )
      ? deliveriesBody.deliveries
      : [];

    const prepagrayIds = [...prepagrayDeliveryIds];

    let queuedCount = 0;
    let failedCount = 0;

    // 5 is only the browser request batch size.
    // It is NOT the campaign sending limit.
    const batchSize = 5;

    for (
      let start = 0;
      start < prepagrayIds.length;
      start += batchSize
    ) {
      const batch = prepagrayIds.slice(
        start,
        start + batchSize,
      );

      const results = await Promise.all(
        batch.map(async (deliveryId) => {
          try {
            const prepagrayDelivery = deliveries.find(
              (delivery: {
                id?: string;
              }) => delivery?.id === deliveryId,
            );

            if (!prepagrayDelivery?.lead_id) {
              throw new Error(
                "Unable to determine the lead for this prepagray delivery.",
              );
            }

            const leadId = prepagrayDelivery.lead_id;

            const aiSubject =
              typeof aiSubjects[leadId] === "string"
                ? aiSubjects[leadId].trim()
                : "";

            const aiMessage =
              typeof aiMessages[leadId] === "string"
                ? aiMessages[leadId].trim()
                : "";

            const usingAiEmail =
              Boolean(aiSubject && aiMessage);

            const requestBody: {
              deliveryId: string;
              inboxId: string;
              subject?: string;
              message?: string;
            } = {
              deliveryId,
              inboxId: selectedInboxId,
            };

            if (usingAiEmail) {
              requestBody.subject = aiSubject;
              requestBody.message = aiMessage;
            }

            const response = await fetch(
              `/api/campaigns/${encodeURIComponent(
                selectedCampaignId,
              )}/send`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
              },
            );

            const body =
              await response.json().catch(() => null);

            if (!response.ok) {
              throw new Error(
                body?.error ??
                  "Unable to queue campaign email.",
              );
            }

            return {
              success: true,
              deliveryId,
            };
          } catch (error) {
            return {
              success: false,
              deliveryId,
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to queue campaign email.",
            };
          }
        }),
      );

      queuedCount += results.filter(
        (result) => result.success,
      ).length;

      failedCount += results.filter(
        (result) => !result.success,
      ).length;
    }

    if (queuedCount > 0) {
      setPrepagrayDeliveryIds((current) =>
        current.filter(
          (id) =>
            !prepagrayIds.includes(id),
        ),
      );
    }

    if (queuedCount > 0 && failedCount === 0) {
      setBulkOutreachMessage(
        `${queuedCount} email${
          queuedCount === 1 ? "" : "s"
        } queued successfully.`,
      );
    } else if (queuedCount > 0 && failedCount > 0) {
      setBulkOutreachMessage(
        `${queuedCount} email${
          queuedCount === 1 ? "" : "s"
        } queued successfully. ${failedCount} failed to queue.`,
      );
    } else {
      setBulkOutreachError(
        "No emails could be queued.",
      );
    }

    await loadDashboardCampaignData();
  } catch (error) {
    setBulkOutreachError(
      error instanceof Error
        ? error.message
        : "Unable to queue campaign emails.",
    );
  } finally {
    setSendDeliveryLoading(false);
  }
}
  
 return (
  <main
    className={`sharelite-shell sharelite-compact min-h-screen md:flex ${
      dark
        ? "bg-black text-slate-100"
        : "bg-[#f5f7fb] text-slate-900"
    }`}
  >
    <style>{`
      .sharelite-compact [class*="text-[18px]"] {
        font-size: 0.92rem !important;
        line-height: 1.15rem !important;
      }

      .sharelite-compact [class*="text-[20px]"] {
        font-size: 1rem !important;
        line-height: 1.2rem !important;
      }

      .sharelite-compact [class*="text-[15px]"] {
        font-size: 0.78rem !important;
        line-height: 1rem !important;
      }

      .sharelite-compact [class*="text-[14px]"] {
        font-size: 0.72rem !important;
        line-height: 0.95rem !important;
      }

      .sharelite-compact [class*="text-[13px]"] {
        font-size: 0.68rem !important;
        line-height: 0.9rem !important;
      }

      .sharelite-compact [class*="text-[12px]"] {
        font-size: 0.65rem !important;
        line-height: 0.85rem !important;
      }

      .sharelite-compact [class*="text-[11px]"] {
        font-size: 0.6rem !important;
        line-height: 0.8rem !important;
      }

      .sharelite-compact [class*="text-[10px]"] {
        font-size: 0.56rem !important;
        line-height: 0.75rem !important;
      }

      .sharelite-compact .text-sm {
        font-size: 0.7rem !important;
        line-height: 0.95rem !important;
      }

      .sharelite-compact .text-xs {
        font-size: 0.64rem !important;
        line-height: 0.85rem !important;
      }

      .sharelite-compact .text-2xl {
        font-size: 1.25rem !important;
        line-height: 1.45rem !important;
      }

      .sharelite-compact .text-3xl {
        font-size: 1.5rem !important;
        line-height: 1.7rem !important;
      }

      .sharelite-compact .p-6 {
        padding: 0.9rem !important;
      }

      .sharelite-compact .p-5 {
        padding: 0.8rem !important;
      }

      .sharelite-compact .p-4 {
        padding: 0.7rem !important;
      }

      .sharelite-compact .p-3 {
        padding: 0.55rem !important;
      }

      .sharelite-compact .px-5 {
        padding-left: 0.75rem !important;
        padding-right: 0.75rem !important;
      }

      .sharelite-compact .px-4 {
        padding-left: 0.65rem !important;
        padding-right: 0.65rem !important;
      }

      .sharelite-compact .px-3 {
        padding-left: 0.55rem !important;
        padding-right: 0.55rem !important;
      }

      .sharelite-compact .py-4 {
        padding-top: 0.65rem !important;
        padding-bottom: 0.65rem !important;
      }

      .sharelite-compact .py-3 {
        padding-top: 0.5rem !important;
        padding-bottom: 0.5rem !important;
      }

      .sharelite-compact .py-2 {
        padding-top: 0.4rem !important;
        padding-bottom: 0.4rem !important;
      }

      .sharelite-compact .gap-5 {
        gap: 0.65rem !important;
      }

      .sharelite-compact .gap-4 {
        gap: 0.55rem !important;
      }

      .sharelite-compact .gap-3 {
        gap: 0.45rem !important;
      }

      .sharelite-compact .gap-2 {
        gap: 0.35rem !important;
      }

      .sharelite-compact .space-y-8 > :not([hidden]) ~ :not([hidden]) {
        margin-top: 0.7rem !important;
      }

      .sharelite-compact .space-y-6 > :not([hidden]) ~ :not([hidden]) {
        margin-top: 0.6rem !important;
      }

      .sharelite-compact input,
      .sharelite-compact select,
      .sharelite-compact textarea {
        font-size: 0.7rem !important;
      }

      .sharelite-compact button,
      .sharelite-compact a {
        -webkit-tap-highlight-color: transparent;
      }
    `}</style>

    <aside
      className={`${
        activeTab === "inbox"
          ? "hidden"
          : "relative z-30 hidden w-[242px] shrink-0 md:sticky md:top-0 md:flex md:h-screen md:flex-col"
      } bg-white`}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3.5 pt-4">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[14px] font-black ${
                dark
                  ? "border-gray-400/25 bg-gray-400/[0.08] text-gray-300"
                  : "border-gray-500/25 bg-gray-50 text-gray-700"
              }`}
              aria-hidden="true"
            >
              S
            </div>

            <div>
              <div className="text-[16px] font-black tracking-[-0.04em]">
                ShareLite
              </div>

              <div className="text-[9px] font-medium text-slate-500">
                Outreach Engine
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition ${
              dark
                ? "border-white/[0.10] bg-white/[0.02] text-slate-400 hover:bg-white/[0.06] hover:text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Logout
          </button>
        </div>

        <nav
          className="mt-5 space-y-5"
          aria-label="Workspace navigation"
        >
          {navGroups.map((group) => (
            <div key={group.title}>
              <div className="mb-2 px-3 text-[9px] font-black tracking-[0.16em] text-slate-400">
                {group.title}
              </div>

              <div className="space-y-1">
                {group.items.map((item) => {
  const mappedTab =
    item.id === "messages"
      ? "inbox"
      : item.id === "approvals"
        ? "reviews"
        : item.id;

  const isBilling = item.id === "billing";
  const isGeoAnalytics = item.id === "geo-analytics";

  const isGeoLocked = false;

  const isActive =
    !isBilling &&
    !isGeoLocked &&
    activeTab === mappedTab;

  if (isBilling) {
    return (
      <Link
        key={item.id}
        href="/plans"
        className="group flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2.5 text-left text-[12px] font-semibold text-slate-700 transition-all duration-200 hover:scale-[1.02] hover:bg-slate-100 hover:text-black"
      >
        <span className="w-5 shrink-0 text-slate-500 transition-colors group-hover:text-black">
          <DashboardIcon name={item.icon} />
        </span>

        <span className="min-w-0 flex-1">
          {item.label}
        </span>
      </Link>
    );
  }

  return (
    <button
      key={item.id}
      type="button"
      onClick={() => {
        if (isGeoLocked) {
          setGeoUpgradeOpen(true);
          return;
        }

        setActiveTab(mappedTab);
      }}
      className={`group flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[12px] font-semibold transition-all duration-200 ${
        isActive
          ? "scale-[1.02] border-blue-600 bg-blue-600 text-white"
          : isGeoLocked
            ? "border-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-500"
            : "border-transparent text-slate-700 hover:scale-[1.02] hover:bg-slate-100 hover:text-black"
      }`}
    >
      <span
        className={`w-5 shrink-0 transition-colors ${
          isActive
            ? "text-white"
            : isGeoLocked
              ? "text-slate-400"
              : "text-slate-500 group-hover:text-black"
        }`}
      >
        <DashboardIcon name={item.icon} />
      </span>

      <span className="min-w-0 flex-1">
        {item.label}
      </span>

      {isGeoLocked && (
        <span
          className="shrink-0 text-[10px] text-slate-400"
          aria-label="Upgrade required"
          title="Upgrade required"
        >
          🔒
        </span>
      )}

      {item.id === "approvals" &&
        pendingApprovals.length > 0 && (
          <span
            className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[9px] font-black ${
              isActive
                ? "bg-white text-blue-600"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {pendingApprovals.length}
          </span>
        )}
    </button>
  );
})}
              </div>
            </div>
          ))}
        </nav>

        <div
          className={`mt-4 rounded-xl border p-3 ${
            dark
              ? "border-white/10 bg-white/[0.025]"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center gap-2 text-[12px] font-medium">
            <span className="text-slate-400">♛</span>
            <span>Free Trial</span>
          </div>

          <div className="mt-1 text-[18px] font-black tracking-[-0.04em]">
            {permanentFree ? (
              <>
                Permanent Free
                <span className="ml-1 text-[10px] font-medium text-slate-400">
                  active
                </span>
              </>
            ) : (
              <>
                {trialCountdown}
                <span className="ml-1 text-[10px] font-medium text-slate-400">
                  remaining
                </span>
              </>
            )}
          </div>

          <div
            className={`mt-2 h-1.5 overflow-hidden rounded-full ${
              dark ? "bg-white/10" : "bg-slate-200"
            }`}
          >
            <div
              className="h-full rounded-full bg-blue-600"
              style={{
                width: permanentFree
                  ? "100%"
                  : trialSeconds === null
                    ? "0%"
                    : `${Math.max(
                        0,
                        Math.min(
                          100,
                          (trialSeconds / (12 * 86400)) * 100,
                        ),
                      )}%`,
              }}
            />
          </div>

          <Link
            href="/plans"
            className="mt-2.5 block rounded-lg bg-blue-600 px-3 py-2.5 text-center text-[11px] font-black text-white transition hover:bg-blue-700"
          >
            Upgrade Now
          </Link>
        </div>
      </div>
    </aside>

    <section className="min-w-0 flex-1">
      <div className="mx-auto w-full max-w-[1320px] px-3 pb-10 pt-3 md:px-4 lg:px-5">


      {activeTab === "geo-analytics" && (
  <GeoAnalytics />
)}

      

        {activeTab === "dashboard" && (
          <>
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
              <div>
                <h1 className="text-[18px] font-black tracking-[-0.04em] md:text-[20px]">
                  Welcome back, {firstName}!{" "}
                  <span className="text-[18px]">👋</span>
                </h1>

                <p
                  className={`mt-0.5 text-[12px] ${
                    dark
                      ? "text-slate-400"
                      : "text-slate-500"
                  }`}
                >
                  Here’s what’s happening with your outreach today.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void refreshDashboard()}
                  disabled={refreshing}
                  className={`hidden rounded-lg border px-3 py-2 text-[10px] font-semibold sm:flex sm:items-center sm:gap-2 ${
                    dark
                      ? "border-white/15 bg-white/[0.02] text-slate-200 hover:bg-white/[0.05]"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{refreshing ? "↻" : "⟳"}</span>
                  {refreshing ? "Refreshing" : "Live"}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("campaigns")}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-black text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)] transition hover:bg-blue-700"
                >
                  <span className="text-lg leading-none">+</span>
                  New Campaign
                </button>
              </div>
            </div>

            {(dataError || refreshError) && (
              <p role="alert" className="mt-4 text-sm text-red-500">
                {refreshError ?? dataError}
              </p>
            )}

            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total Leads",
                  value: counts.total,
                  icon: "leads",
                  accent: "blue",
                  change: changes.total,
                  text: "this period",
                },
                {
                  label: "Valid Leads",
                  value: counts.valid,
                  icon: "approvals",
                  accent: "green",
                  change: null,
                  text: counts.total
                    ? `${(
                        (counts.valid / counts.total) *
                        100
                      ).toFixed(1)}% of total`
                    : "0% of total",
                },
                {
                  label: "Invalid Leads",
                  value: invalidLeadCount,
                  icon: "x",
                  accent: "purple",
                  change: null,
                  text: counts.total
                    ? `${(
                        (invalidLeadCount / counts.total) *
                        100
                      ).toFixed(1)}% of total`
                    : "0% of total",
                },
                {
                  label: "Emails Sent",
                  value: emailsSentCount,
                  icon: "campaigns",
                  accent: "orange",
                  change: null,
                  text: "from campaign deliveries",
                },
              ].map((stat) => {
                const accent =
                  stat.accent === "blue"
                    ? "text-blue-600 bg-blue-50 ring-blue-100"
                    : stat.accent === "green"
                      ? "text-emerald-600 bg-emerald-50 ring-emerald-100"
                      : stat.accent === "purple"
                        ? "text-violet-600 bg-violet-50 ring-violet-100"
                        : stat.accent === "orange"
                          ? "text-orange-500 bg-orange-50 ring-orange-100"
                          : "text-slate-500 bg-slate-50 ring-slate-100";

                return (
                  <div
                    key={stat.label}
                    className={`relative overflow-hidden rounded-xl border p-3 ${
                      dark
                        ? "border-white/[0.08] bg-white/[0.04]"
                        : "border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-6 ${accent}`}
                      >
                        {stat.icon === "x" ? (
                          <span className="text-base font-black">
                            ×
                          </span>
                        ) : (
                          <DashboardIcon
                            name={stat.icon}
                            size={17}
                          />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div
                          className={`text-[11px] ${
                            dark
                              ? "text-slate-300"
                              : "text-slate-500"
                          }`}
                        >
                          {stat.label}
                        </div>

                        <div className="mt-1 text-[16px] font-black tracking-[-0.04em]">
                          {stat.value.toLocaleString()}
                        </div>

                        <div className="mt-1 text-[11px] font-semibold text-slate-500">
                          {stat.change !== null
                            ? `${
                                stat.change > 0
                                  ? "↑ +"
                                  : stat.change < 0
                                    ? "↓ "
                                    : "• "
                              }${Math.round(
                                stat.change * 10,
                              ) / 10}% ${stat.text}`
                            : stat.text}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
              <div
                className={`h-full overflow-hidden rounded-xl border ${
                  dark
                    ? "border-white/[0.08] bg-white/[0.04]"
                    : "border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]"
                }`}
              >
                <div className="flex items-center justify-between px-5 py-3.5">
                  <h2 className="text-[15px] font-black">
                    Campaign Status
                  </h2>
                </div>

                <div className="flex min-h-[220px] flex-col justify-between px-4 py-4 sm:px-5 sm:py-5">
                  <div className="flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-7">
                    <div
                      className="relative h-[138px] w-[138px] shrink-0 rounded-full sm:h-[150px] sm:w-[150px]"
                      style={{
                        background:
                          campaignStatusTotal === 0
                            ? dark
                              ? "rgba(255,255,255,0.06)"
                              : "rgba(15,23,42,0.08)"
                            : `conic-gradient(
                                #10b981 0 ${
                                  (campaignStatus.active /
                                    campaignStatusTotal) *
                                  100
                                }%,
                                #3b82f6 ${
                                  (campaignStatus.active /
                                    campaignStatusTotal) *
                                  100
                                }% ${
                                  ((campaignStatus.active +
                                    campaignStatus.completed) /
                                    campaignStatusTotal) *
                                  100
                                }%,
                                #f59e0b ${
                                  ((campaignStatus.active +
                                    campaignStatus.completed) /
                                    campaignStatusTotal) *
                                  100
                                }% ${
                                  ((campaignStatus.active +
                                    campaignStatus.completed +
                                    campaignStatus.draft) /
                                    campaignStatusTotal) *
                                  100
                                }%,
                                #94a3b8 ${
                                  ((campaignStatus.active +
                                    campaignStatus.completed +
                                    campaignStatus.draft) /
                                    campaignStatusTotal) *
                                  100
                                }% 100%
                              )`,
                      }}
                    >
                      <div className="absolute inset-[25px] flex flex-col items-center justify-center rounded-full bg-white">
                        <div className="text-3xl font-black text-slate-900">
                          {campaignStatusTotal}
                        </div>
                        <div className="text-xs text-slate-500">
                          Total
                        </div>
                      </div>
                    </div>

                    <div className="w-full min-w-0 max-w-[250px] space-y-2.5">
                      {[
                        ["Active", campaignStatus.active, "#10b981"],
                        [
                          "Completed",
                          campaignStatus.completed,
                          "#3b82f6",
                        ],
                        ["Draft", campaignStatus.draft, "#f59e0b"],
                        ["Paused", campaignStatus.paused, "#94a3b8"],
                      ].map(([label, value, color]) => {
                        const percent = campaignStatusTotal
                          ? (Number(value) /
                              campaignStatusTotal) *
                            100
                          : 0;

                        return (
                          <div
                            key={String(label)}
                            className="flex items-center gap-3 text-sm"
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor: String(color),
                              }}
                            />

                            <span className="min-w-[72px] text-slate-500">
                              {label}
                            </span>

                            <span className="ml-auto font-semibold">
                              {value} ({percent.toFixed(1)}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab("campaigns")}
                    className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-xs font-semibold ${
                      dark
                        ? "border-white/10 text-slate-200 hover:bg-white/[0.04]"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    View All Campaigns
                    <span>→</span>
                  </button>
                </div>
              </div>

              <div
                id="delivery-lifecycle"
                className={`h-full rounded-xl border p-4 md:p-5 ${
                  dark
                    ? "border-white/[0.08] bg-white/[0.04]"
                    : "border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]"
                }`}
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                  <div>
                    <div
                      className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                        dark
                          ? "text-slate-500"
                          : "text-slate-400"
                      }`}
                    >
                      Email infrastructure
                    </div>

                    <h2 className="mt-2 text-base font-black">
                      Delivery Lifecycle
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      Real delivery status from your campaign emails.
                    </p>
                  </div>

                  <div className="text-xs font-semibold text-slate-500">
                    User-specific provider data
                  </div>
                </div>

                
                  <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
  {[
    ["Pending", deliveryLifecycle.pending],
    ["Sending", deliveryLifecycle.sending],
    ["Accepted", deliveryLifecycle.accepted],
    ["Delivered", deliveryLifecycle.delivered],
    ["Bounced", deliveryLifecycle.bounced],
    ["Failed", deliveryLifecycle.failed],
  ].map(([label, value], index) => (
    <div
      key={String(label)}
      className={`min-w-0 overflow-hidden rounded-lg border p-3 sm:p-4 ${
        dark
          ? "border-white/[0.08] bg-white"
          : "border-slate-200 bg-white"
      }`}
    >
      <div
  className={`min-w-0 break-words text-[9px] font-bold uppercase leading-tight tracking-[0.08em] ${
    index === 0
      ? "text-blue-500"
      : index === 1
      ? "text-violet-500"
      : index === 2
      ? "text-emerald-500"
      : index === 3
      ? "text-cyan-500"
      : index === 4
      ? "text-orange-500"
      : "text-red-500"
  }`}
>
  {label}
</div>

      <div
        className={`mt-2 text-2xl font-black tracking-[-0.03em] ${
          index === 0
            ? "text-blue-600"
            : index === 1
            ? "text-violet-600"
            : index === 2
            ? "text-emerald-600"
            : index === 3
            ? "text-cyan-600"
            : index === 4
            ? "text-orange-600"
            : "text-red-600"
        }`}
      >
        {value}
      </div>
    </div>
  ))}
</div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div
                    className={`rounded-lg border p-4 ${
                      dark
                        ? "border-white/10 bg-white/[0.03]"
                        : "border-slate-200 bg-slate-50/60"
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      Delivery rate
                    </div>

                    <div className="mt-2 text-3xl font-black text-emerald-600">
                      {deliveryLifecycle.deliveryRate}%
                    </div>
                  </div>

                  <div
                    className={`rounded-lg border p-4 ${
                      dark
                        ? "border-white/10 bg-white/[0.03]"
                        : "border-slate-200 bg-slate-50/60"
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      Bounce rate
                    </div>

                    <div className="mt-2 text-3xl font-black text-orange-600">
                      {deliveryLifecycle.bounceRate}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div
                className={`h-full overflow-hidden rounded-xl border ${
                  dark
                    ? "border-white/[0.08] bg-white/[0.04]"
                    : "border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]"
                }`}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <h2 className="text-[15px] font-black">
                    Recent Campaigns
                  </h2>

                  <button
                    type="button"
                    onClick={() => setActiveTab("campaigns")}
                    className={`rounded-lg border px-3 py-2 text-[11px] font-semibold ${
                      dark
                        ? "border-white/10 text-slate-300"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    View All
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {dashboardCampaignLoading &&
                  recentCampaigns.length === 0 ? (
                    <div className="px-5 py-7 text-center text-sm text-slate-500">
                      Loading your campaigns…
                    </div>
                  ) : recentCampaigns.length === 0 ? (
                    <div className="px-5 py-7 text-center text-sm text-slate-500">
                      No campaigns yet.
                    </div>
                  ) : (
                    recentCampaigns.map((campaign, index) => {
                      const deliveryStats =
                        campaignDeliveryStats(campaign.id);

                      const iconName =
                        index === 0
                          ? "campaigns"
                          : index === 1
                            ? "messages"
                            : "leads";

                      const statusClass =
                        campaign.status === "active"
                          ? "bg-emerald-50 text-emerald-600"
                          : campaign.status === "completed"
                            ? "bg-blue-50 text-blue-600"
                            : campaign.status === "paused"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-orange-50 text-orange-600";

                      return (
                        <div
                          key={campaign.id}
                          className="flex items-center gap-3 px-4 py-3"
                        >
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                              index === 0
                                ? "bg-blue-50 text-blue-600"
                                : index === 1
                                  ? "bg-violet-50 text-violet-600"
                                  : "bg-emerald-50 text-emerald-600"
                            }`}
                          >
                            <DashboardIcon name={iconName} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold">
                              {campaign.name}
                            </div>

                            <div className="mt-1 text-[11px] text-slate-500">
                              Created on{" "}
                              {new Date(
                                campaign.created_at,
                              ).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                          </div>

                          <div className="hidden grid-cols-3 gap-5 md:grid">
                            <div className="text-center">
                              <div className="text-sm font-black">
                                {deliveryStats.sent}
                              </div>

                              <div className="text-[10px] text-slate-500">
                                Sent
                              </div>
                            </div>

                            <div className="text-center">
                              <div className="text-sm font-black">
                                {deliveryStats.delivered}
                              </div>

                              <div className="text-[10px] text-slate-500">
                                delivered
                              </div>
                            </div>

                            <div className="text-center">
                              <div className="text-sm font-black">
                                {deliveryStats.failed}
                              </div>

                              <div className="text-[10px] text-slate-500">
                                Failed
                              </div>
                            </div>
                          </div>

                          <span
                            className={`rounded-md px-2.5 py-1 text-[10px] font-bold capitalize ${statusClass}`}
                          >
                            {campaign.status}
                          </span>

                          <span className="hidden w-14 text-right text-[10px] text-slate-500 sm:block">
                            {relativeTime(campaign.created_at)}
                          </span>

                          <span className="text-slate-400">⋮</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div
                className={`h-full overflow-hidden rounded-xl border ${
                  dark
                    ? "border-white/[0.08] bg-white/[0.04]"
                    : "border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]"
                }`}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <h2 className="text-[15px] font-black">
                    Approval Queue
                  </h2>

                  <button
                    type="button"
                    onClick={() => setActiveTab("reviews")}
                    className={`rounded-lg border px-3 py-2 text-[11px] font-semibold ${
                      dark
                        ? "border-white/10 text-slate-300"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    View All
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {pendingApprovals.length === 0 ? (
                    <div className="px-5 py-7 text-center text-sm text-slate-500">
                      No leads are waiting for review.
                    </div>
                  ) : (
                    pendingApprovals.map((lead, index) => {
                      const initials = lead.name
                        .split(/\s+/)
                        .map((part) => part.charAt(0))
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();

                      return (
                        <div
                          key={lead.id}
                          className="flex items-center gap-3 px-4 py-3"
                        >
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-black text-white ${
                              index === 0
                                ? "bg-blue-600"
                                : index === 1
                                  ? "bg-violet-600"
                                  : "bg-emerald-600"
                            }`}
                          >
                            {initials || "L"}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold">
                              {lead.name}
                            </div>

                            <div className="truncate text-[11px] text-slate-500">
                              {lead.email}
                            </div>
                          </div>

                          <span className="hidden rounded-full bg-violet-50 px-3 py-1 text-[10px] font-semibold text-violet-600 sm:block">
                            Personalization
                          </span>

                          <span className="w-12 text-right text-[10px] text-slate-500">
                            {relativeTime(
                              (
                                lead as Lead & {
                                  created_at?: string;
                                }
                              ).created_at,
                            )}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-xs font-semibold text-slate-500">
                    {pendingApprovals.length} pending approvals
                  </span>

                  <button
                    type="button"
                    onClick={() => setActiveTab("reviews")}
                    className="text-xs font-semibold text-blue-600"
                  >
                    Review All →
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "leads" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-black">Leads</h2>

                <p className="mt-1 text-xs text-slate-400">
                  Manage your outreach leads.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={importCsv}
                  className="hidden"
                  id="csv-leads-upload"
                />

                <label
                  htmlFor="csv-leads-upload"
                  className={`cursor-pointer rounded-xl border px-3 py-2 text-[11px] font-black transition ${
                    dark
                      ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
                      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                  } ${
                    importing
                      ? "pointer-events-none opacity-60"
                      : ""
                  }`}
                >
                  {importing ? "Importing..." : "Import CSV"}
                </label>

                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className={`rounded-xl border px-3 py-2 text-[11px] font-black transition ${
                    dark
                      ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
                      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  Download Template
                </button>
              </div>
            </div>

            <form
              onSubmit={submitLead}
              className={`grid grid-cols-1 gap-2.5 rounded-2xl border p-4 md:grid-cols-3 ${
                dark
                  ? "border-white/10 bg-white/[0.03]"
                  : "border-slate-200 bg-white"
              }`}
            >
              <input
                required
                placeholder="Name"
                value={leadForm.name}
                onChange={(event) =>
                  setLeadForm({
                    ...leadForm,
                    name: event.target.value,
                  })
                }
                className={`rounded-xl border px-3 py-2 text-xs ${
                  dark
                    ? "border-white/10 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-900"
                }`}
              />

              <input
                required
                type="email"
                placeholder="Email"
                value={leadForm.email}
                onChange={(event) =>
                  setLeadForm({
                    ...leadForm,
                    email: event.target.value,
                  })
                }
                className={`rounded-xl border px-3 py-2 text-xs ${
                  dark
                    ? "border-white/10 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-900"
                }`}
              />

              <input
                required
                placeholder="Company"
                value={leadForm.company}
                onChange={(event) =>
                  setLeadForm({
                    ...leadForm,
                    company: event.target.value,
                  })
                }
                className={`rounded-xl border px-3 py-2 text-xs ${
                  dark
                    ? "border-white/10 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-900"
                }`}
              />

               <select
  value={leadForm.country_code}
  onChange={(event) => {
    const code = event.target.value;

    const countryNames: Record<string, string> = {
      IN: "India",
      US: "United States",
      GB: "United Kingdom",
      CA: "Canada",
      AU: "Australia",
      DE: "Germany",
      FR: "France",
      AE: "United Arab Emirates",
      SG: "Singapore",
      JP: "Japan",
      CN: "China",
      BR: "Brazil",
      ES: "Spain",
      IT: "Italy",
      NL: "Netherlands",
      ZA: "South Africa",
      NZ: "New Zealand",
      RU: "Russia",
      MX: "Mexico",
      SA: "Saudi Arabia",
    };

    setLeadForm({
      ...leadForm,
      country_code: code,
      country_name: countryNames[code] ?? "",
    });
  }}
  className={`rounded-xl border px-3 py-3 text-sm ${
    dark
      ? "border-white/10 bg-slate-900 text-white"
      : "border-slate-200 bg-white text-slate-900"
  }`}
>
  <option value="">Country</option>
  <option value="IN">🇮🇳 India</option>
  <option value="US">🇺🇸 United States</option>
  <option value="GB">🇬🇧 United Kingdom</option>
  <option value="CA">🇨🇦 Canada</option>
  <option value="AU">🇦🇺 Australia</option>
  <option value="DE">🇩🇪 Germany</option>
  <option value="FR">🇫🇷 France</option>
  <option value="AE">🇦🇪 United Arab Emirates</option>
  <option value="SG">🇸🇬 Singapore</option>
  <option value="JP">🇯🇵 Japan</option>
  <option value="CN">🇨🇳 China</option>
  <option value="BR">🇧🇷 Brazil</option>
  <option value="ES">🇪🇸 Spain</option>
  <option value="IT">🇮🇹 Italy</option>
  <option value="NL">🇳🇱 Netherlands</option>
  <option value="ZA">🇿🇦 South Africa</option>
  <option value="NZ">🇳🇿 New Zealand</option>
  <option value="RU">🇷🇺 Russia</option>
  <option value="MX">🇲🇽 Mexico</option>
  <option value="SA">🇸🇦 Saudi Arabia</option>
</select>

              <input
                placeholder="Website"
                value={leadForm.website}
                onChange={(event) =>
                  setLeadForm({
                    ...leadForm,
                    website: event.target.value,
                  })
                }
                className={`rounded-xl border px-3 py-2 text-xs ${
                  dark
                    ? "border-white/10 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-900"
                }`}
              />

              <select
                value={leadForm.status}
                onChange={(event) =>
                  setLeadForm({
                    ...leadForm,
                    status: event.target.value as LeadStatus,
                  })
                }
                className={`rounded-xl border px-3 py-2 text-xs ${
                  dark
                    ? "border-white/10 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-900"
                }`}
              >
                <option value="new">New</option>
                <option value="valid">Valid</option>
                <option value="contacted">Contacted</option>
                <option value="converted">Converted</option>
              </select>

              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-black text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {pending
                  ? "Saving..."
                  : editingId
                    ? "Save Lead"
                    : "Add Lead"}
              </button>
            </form>

            {leadError && (
              <p role="alert" className="text-xs text-red-500">
                {leadError}
              </p>
            )}

            {importSummary && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-600">
                {importSummary}
              </div>
            )}

            <div
              className={`rounded-2xl border p-4 ${
                dark
                  ? "border-white/10 bg-white/[0.03]"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-[13px] font-black">
                      Bulk Outreach
                    </h3>

                    <p className="text-[11px] text-slate-500">
                      Select leads and prepare them for a campaign.
                    </p>
                  </div>

                  <span className="text-xs font-bold text-slate-500">
                    {selectedLeadIds.length} selected
                  </span>
                </div>

                <select
                  value={selectedCampaignId}
                  onChange={(event) =>
                    setSelectedCampaignId(event.target.value)
                  }
                  className={`w-full rounded-xl border px-3 py-2 text-xs ${
                    dark
                      ? "border-white/10 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-900"
                  }`}
                >
                  <option value="">Select campaign</option>

                  {campaigns.map((campaign) => (
                    <option
                      key={campaign.id}
                      value={campaign.id}
                      disabled={!campaign.template_id}
                    >
                      {campaign.name}
                      {!campaign.template_id
                        ? " — template required"
                        : ""}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedInboxId ?? ""}
                  onChange={(event) =>
                    setSelectedInboxId(
                      event.target.value || null,
                    )
                  }
                  className={`w-full rounded-xl border px-3 py-2 text-xs ${
                    dark
                      ? "border-white/10 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-900"
                  }`}
                >
                  <option value="">Select sending Gmail</option>

                  {connectedInboxes
                    .filter(
                      (inbox) =>
                        inbox.provider === "google" &&
                        inbox.status === "active",
                    )
                    .map((inbox) => (
                      <option
                        key={inbox.id}
                        value={inbox.id}
                      >
                        {inbox.email}
                      </option>
                    ))}
                </select>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllLeads}
                    disabled={!leadRows.length}
                    className={`rounded-xl border px-3 py-1.5 text-[11px] font-black ${
                      dark
                        ? "border-white/10 text-white hover:bg-white/5"
                        : "border-slate-200 text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    Select All
                  </button>

                  <button
                    type="button"
                    onClick={clearSelectedLeads}
                    disabled={!selectedLeadIds.length}
                    className={`rounded-xl border px-3 py-1.5 text-[11px] font-black ${
                      dark
                        ? "border-white/10 text-slate-300 hover:bg-white/5"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void prepareBulkCampaign()
                    }
                    disabled={
                      bulkOutreachLoading ||
                      !selectedCampaignId ||
                      !selectedLeadIds.length
                    }
                    className="rounded-xl bg-blue-600 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {bulkOutreachLoading
                      ? "Preparing..."
                      : "Prepare Campaign"}
                  </button>

                  <button
                    type="button"
                    onClick={sendPrepagrayDelivery}
                    disabled={
                      sendDeliveryLoading ||
                      prepagrayDeliveryIds.length === 0 ||
                      !selectedInboxId
                    }
                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendDeliveryLoading
                      ? "Sending..."
                      : "Send Prepared Email"}
                  </button>
                </div>

                {campaigns.length === 0 && (
                  <p className="text-xs text-slate-500">
                    Create a campaign with an outreach template first.
                  </p>
                )}

                {bulkOutreachError && (
                  <p
                    role="alert"
                    className="text-xs text-red-500"
                  >
                    {bulkOutreachError}
                  </p>
                )}

                {bulkOutreachMessage && (
                  <p className="text-xs text-emerald-600">
                    {bulkOutreachMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {leadRows.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-400">
                  No leads yet.
                </div>
              ) : (
                leadRows.map((lead) => (
                  <div
                    key={lead.id}
                    className={`relative rounded-xl border p-3 ${
                      dark
                        ? "border-white/10 bg-white/[0.03]"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(
                        lead.id,
                      )}
                      onChange={() =>
                        toggleLeadSelection(lead.id)
                      }
                      aria-label={`Select ${lead.name} for bulk outreach`}
                      className="absolute left-4 top-4 h-4 w-4 cursor-pointer accent-blue-600"
                    />

                    <div className="flex flex-col justify-between gap-3 pl-7 md:flex-row">
                      <div>
                        <div className="text-sm font-bold">
                          {lead.name}
                        </div>

                        <div className="text-xs text-slate-400">
                          {lead.email}
                          {lead.company
                            ? ` · ${lead.company}`
                            : ""}
                        </div>

                        <div className="mt-0.5 text-[11px] capitalize text-slate-500">
                          Status: {lead.status}
                        </div>

                        {lead.validation_status && (
                          <div className="mt-0.5 text-[11px] text-blue-600">
                            Email: {lead.validation_status}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => editLead(lead)}
                          className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-600"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void validateLead(lead.id)
                          }
                          className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-blue-700"
                        >
                          Validate
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void generateAiMessage(lead.id)
                          }
                          disabled={
                            aiLoadingId === lead.id
                          }
                          className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {aiLoadingId === lead.id
                            ? "Generating..."
                            : "AI Message"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void removeLead(lead.id)
                          }
                          className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {aiMessages[lead.id] && (
                      <div className="mt-3 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label
                            htmlFor={`ai-subject-${lead.id}`}
                            className="text-[10px] font-black uppercase tracking-wide text-slate-400"
                          >
                            AI Personalized Email
                          </label>

                          <button
                            type="button"
                            onClick={() =>
                              void copyAiMessage(lead.id)
                            }
                            className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-black text-white transition hover:bg-blue-700"
                          >
                            Copy Email
                          </button>
                        </div>

                        <input
                          id={`ai-subject-${lead.id}`}
                          value={aiSubjects[lead.id] ?? ""}
                          onChange={(event) =>
                            setAiSubjects((current) => ({
                              ...current,
                              [lead.id]:
                                event.target.value,
                            }))
                          }
                          placeholder="AI-generated subject"
                          className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 ${
                            dark
                              ? "border-white/10 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-900"
                          }`}
                        />

                        <textarea
                          id={`ai-message-${lead.id}`}
                          value={aiMessages[lead.id]}
                          onChange={(event) =>
                            setAiMessages((current) => ({
                              ...current,
                              [lead.id]:
                                event.target.value,
                            }))
                          }
                          rows={6}
                          spellCheck={false}
                          aria-label="Generated AI outreach message"
                          className={`w-full resize-y rounded-xl border p-3 text-xs leading-5 whitespace-pre-wrap outline-none focus:ring-2 focus:ring-blue-500 ${
                            dark
                              ? "border-white/10 bg-slate-900 text-slate-100"
                              : "border-slate-200 bg-white text-slate-900"
                          }`}
                        />

                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] text-slate-500">
                            Review and edit the AI email before using it.
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              void generateAiMessage(
                                lead.id,
                              )
                            }
                            disabled={
                              aiLoadingId === lead.id
                            }
                            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {aiLoadingId === lead.id
                              ? "Generating..."
                              : "Regenerate"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div
                      className={`mt-3 rounded-xl border p-3 ${
                        dark
                          ? "border-white/10 bg-white/[0.02]"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-[13px] font-black">
                            Outreach Message
                          </h4>

                          <p className="mt-1 text-[11px] text-slate-500">
                            Create a personalized message from a saved template.
                          </p>
                        </div>

                        {templatesLoading ? (
                          <p className="text-[11px] text-slate-500">
                            Loading templates...
                          </p>
                        ) : outreachTemplates.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            No templates found. Create one in Templates first.
                          </p>
                        ) : (
                          <>
                            <select
                              value={
                                selectedTemplateIds[
                                  lead.id
                                ] ?? ""
                              }
                              onChange={(event) =>
                                applyOutreachTemplate(
                                  lead,
                                  event.target.value,
                                )
                              }
                              className={`w-full rounded-xl border px-3 py-2 text-xs ${
                                dark
                                  ? "border-white/10 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-900"
                              }`}
                            >
                              <option value="">
                                Select an outreach template
                              </option>

                              {outreachTemplates.map(
                                (template) => (
                                  <option
                                    key={template.id}
                                    value={template.id}
                                  >
                                    {template.name}
                                  </option>
                                ),
                              )}
                            </select>

                            {outreachSubjects[
                              lead.id
                            ] !== undefined && (
                              <input
                                value={
                                  outreachSubjects[
                                    lead.id
                                  ]
                                }
                                onChange={(event) =>
                                  setOutreachSubjects(
                                    (current) => ({
                                      ...current,
                                      [lead.id]:
                                        event.target.value,
                                    }),
                                  )
                                }
                                placeholder="Email subject"
                                className={`w-full rounded-xl border px-3 py-2 text-xs ${
                                  dark
                                    ? "border-white/10 bg-slate-900 text-white"
                                    : "border-slate-200 bg-white text-slate-900"
                                }`}
                              />
                            )}

                            {outreachMessages[
                              lead.id
                            ] !== undefined && (
                              <>
                                <textarea
                                  value={
                                    outreachMessages[
                                      lead.id
                                    ]
                                  }
                                  onChange={(event) =>
                                    setOutreachMessages(
                                      (current) => ({
                                        ...current,
                                        [lead.id]:
                                          event.target.value,
                                      }),
                                    )
                                  }
                                  rows={6}
                                  className={`w-full resize-y rounded-xl border p-3 text-xs leading-5 outline-none ${
                                    dark
                                      ? "border-white/10 bg-slate-900 text-slate-100"
                                      : "border-slate-200 bg-white text-slate-900"
                                  }`}
                                />

                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void copyOutreachMessage(
                                        lead.id,
                                      )
                                    }
                                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-black text-white transition hover:bg-blue-700"
                                  >
                                    Copy Message
                                  </button>
                                </div>
                              </>
                            )}
                          </>
                        )}

                        {templatesError && (
                          <p className="text-xs text-red-500">
                            {templatesError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "reviews" && (
          <ReviewsPanel dark={dark} />
        )}

        {activeTab === "campaigns" && (
          <WorkspacePanels
            activeTab="campaigns"
            user={user}
            dark={dark}
            onInboxBack={() =>
              setActiveTab("dashboard")
            }
            onInboxSelect={(inboxId) => {
              setSelectedInboxId(inboxId);
            }}
          />
        )}

        {activeTab !== "dashboard" &&
          activeTab !== "leads" &&
          activeTab !== "reviews" &&
          activeTab !== "campaigns" && (
            <WorkspacePanels
              activeTab={activeTab}
              user={user}
              dark={dark}
              onInboxBack={() =>
                setActiveTab("dashboard")
              }
              onInboxSelect={(inboxId) => {
                setSelectedInboxId(inboxId);
              }}
            />
          )}
      </div>
    </section>

    {logoutOpen && (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5"
        onClick={() => setLogoutOpen(false)}
      >
        <div
          className={`w-full max-w-sm rounded-2xl border p-6 ${
            dark
              ? "border-white/10 bg-slate-950"
              : "border-slate-200 bg-white"
          }`}
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <h2
            id="logout-title"
            className="text-lg font-black"
          >
            Are you sure you want to log out?
          </h2>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setLogoutOpen(false)
              }
              className={`rounded-xl border px-4 py-2 text-sm font-bold ${
                dark
                  ? "border-white/10 text-white"
                  : "border-slate-200 text-slate-800"
              }`}
            >
              Cancel
            </button>

            <form
              action="/api/auth/logout"
              method="post"
            >
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </div>
    )}
  </main>
);
}