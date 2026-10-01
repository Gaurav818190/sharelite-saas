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
  onInboxBack?: () => void;
  onInboxSelect?: (inboxId: string | null) => void;
};

type Entitlements = {
  plan:
    | "free"
    | "pro"
    | "business"
    | "scale"
    | "enterprise"
    | "yearly_unlimited"
    | "ultimate_growth";
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

type ConnectedInbox = {
  id: string;
  email: string;
  display_name: string | null;
  provider: "google" | "smtp";
  status: "active" | "paused" | "disconnected";
  daily_send_limit: number;
  daily_sent_count: number;
  daily_count_date: string;
  last_sent_at: string | null;
  created_at: string;
};

type GmailMessage = {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string | null;
  labelIds: string[];
  from: string | null;
  to: string | null;
  cc: string | null;
  subject: string | null;
  date: string | null;
  text: string;
  html: string;
};

const panelClass = "rounded-2xl border p-6";

export default function WorkspacePanels({
  activeTab,
  user,
  dark,
  onInboxBack,
}: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [deliveryCounts, setDeliveryCounts] = useState<
    Record<
      string,
      {
        pending: number;
        sending: number;
        accepted: number;
        failed: number;
      }
    >
  >({});
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [campaignName, setCampaignName] = useState("");
  const [campaignTemplateId, setCampaignTemplateId] = useState("");
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(
    null
  );

  const [templateName, setTemplateName] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [entitlements, setEntitlements] =
    useState<Entitlements | null>(null);

  const [hasActivePaidPlan, setHasActivePaidPlan] = useState(false);

  const [connectedInboxes, setConnectedInboxes] = useState<
    ConnectedInbox[]
  >([]);

  const [updatingInboxId, setUpdatingInboxId] = useState<string | null>(
    null
  );

  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [selectedGmailMessage, setSelectedGmailMessage] =
    useState<GmailMessage | null>(null);

  const [gmailInboxId, setGmailInboxId] = useState<string | null>(null);
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(
    null
  );

  const [loadingInboxMessages, setLoadingInboxMessages] = useState(false);

  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sendingGmail, setSendingGmail] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const card = `${panelClass} ${
    dark
      ? "border-white/[0.08] bg-white/[0.02]"
      : "border-slate-200 bg-white shadow-sm"
  }`;

  const inputClass = `mt-2 h-11 w-full rounded-xl border px-3 text-sm outline-none transition ${
    dark
      ? "border-white/10 bg-[#171717] text-white placeholder:text-slate-500 focus:border-gray-400"
      : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-gray-500"
  }`;

  const buttonClass =
    "cursor-pointer rounded-xl bg-gray-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-50";

  const selectedInbox =
    connectedInboxes.find((inbox) => inbox.id === selectedInboxId) ?? null;

  const googleInboxes = connectedInboxes.filter(
    (inbox) =>
      inbox.provider === "google" &&
      inbox.status !== "disconnected"
  );

  function getInboxSentToday(inbox: ConnectedInbox) {
    const today = new Date().toISOString().slice(0, 10);

    return inbox.daily_count_date === today
      ? Math.max(inbox.daily_sent_count, 0)
      : 0;
  }

  function getInboxLimit(inbox: ConnectedInbox) {
    return Math.max(inbox.daily_send_limit || 100, 1);
  }

  function formatMessageTime(message: GmailMessage) {
    const value = message.internalDate ?? message.date;

    if (!value) {
      return "";
    }

    const timestamp = Number(value);

    const date = Number.isNaN(timestamp)
      ? new Date(value)
      : new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function getSenderEmail(value: string | null) {
    if (!value) {
      return "Unknown sender";
    }

    const match = value.match(/<([^>]+)>/);

    return match?.[1] ?? value;
  }

  function getSenderName(value: string | null) {
    if (!value) {
      return "Unknown sender";
    }

    const match = value.match(/^"?([^"<]+?)"?\s*<[^>]+>/);

    return match?.[1]?.trim() ?? getSenderEmail(value);
  }

  const loadInboxMessages = useCallback(
    async (inboxId: string) => {
      setLoadingInboxMessages(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/inboxes/${encodeURIComponent(
            inboxId
          )}/messages?maxResults=50`,
          {
            cache: "no-store",
          }
        );

        const body = await response.json();

        if (!response.ok) {
          throw new Error(
            body.error ?? "Unable to load inbox messages."
          );
        }

        const messages = (body.messages ?? []) as GmailMessage[];
        setGmailMessages(messages);

        setSelectedGmailMessage((current) => {
          if (current && messages.some((message) => message.id === current.id)) {
            return current;
          }
          return null;
        });
      } catch (err) {
        setGmailMessages([]);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load inbox messages."
        );
      } finally {
        setLoadingInboxMessages(false);
      }
    },
    []
  );

  const load = useCallback(async () => {
    setError(null);
    setSuccess(null);

    try {
      if (activeTab === "campaigns") {
        const inboxResponse = await fetch("/api/inboxes", {
          cache: "no-store",
        });

        const inboxBody = await inboxResponse.json().catch(() => null);

        if (!inboxResponse.ok) {
          throw new Error(
            inboxBody?.error ??
              "Unable to load connected Gmail inboxes."
          );
        }

        const inboxes =
          (inboxBody?.inboxes ?? []) as ConnectedInbox[];

        setConnectedInboxes(inboxes);

        const activeGoogleInboxes = inboxes.filter(
          (inbox) =>
            inbox.provider === "google" &&
            inbox.status === "active"
        );

        const currentSelectedExists = Boolean(
          selectedInboxId &&
            activeGoogleInboxes.some(
              (inbox) => inbox.id === selectedInboxId
            )
        );

        const nextInboxId = currentSelectedExists
          ? selectedInboxId
          : activeGoogleInboxes[0]?.id ?? null;

        setSelectedInboxId(nextInboxId);
        setGmailInboxId(nextInboxId);

        const response = await fetch("/api/campaigns", {
          cache: "no-store",
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(
            body.error ?? "Unable to load campaigns."
          );
        }

        const loadedCampaigns =
          (body.campaigns ?? []) as Campaign[];

        setCampaigns(loadedCampaigns);

        const deliveryEntries = await Promise.all(
          loadedCampaigns.map(async (campaign) => {
            try {
              const response = await fetch(
                `/api/campaigns/${encodeURIComponent(
                  campaign.id
                )}/deliveries`,
                {
                  cache: "no-store",
                }
              );

              if (!response.ok) {
                return [
                  campaign.id,
                  {
                    pending: 0,
                    sending: 0,
                    accepted: 0,
                    failed: 0,
                  },
                ] as const;
              }

              const deliveryBody = await response.json();

              const counts = {
                pending: 0,
                sending: 0,
                accepted: 0,
                failed: 0,
              };

              for (const delivery of deliveryBody.deliveries ?? []) {
                if (delivery.status in counts) {
                  counts[
                    delivery.status as keyof typeof counts
                  ] += 1;
                }
              }

              return [campaign.id, counts] as const;
            } catch {
              return [
                campaign.id,
                {
                  pending: 0,
                  sending: 0,
                  accepted: 0,
                  failed: 0,
                },
              ] as const;
            }
          })
        );

        setDeliveryCounts(
          Object.fromEntries(deliveryEntries)
        );

        const templatesResponse = await fetch(
          "/api/templates",
          {
            cache: "no-store",
          }
        );

        const templatesBody =
          await templatesResponse.json();

        if (!templatesResponse.ok) {
          throw new Error(
            templatesBody.error ??
              "Unable to load outreach templates."
          );
        }

        setTemplates(templatesBody.templates ?? []);
      }

      if (activeTab === "templates") {
        const response = await fetch("/api/templates", {
          cache: "no-store",
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(
            body.error ?? "Unable to load templates."
          );
        }

        setTemplates(body.templates ?? []);
      }

      if (activeTab === "analytics") {
        const response = await fetch("/api/analytics", {
          cache: "no-store",
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(
            body.error ?? "Unable to load analytics."
          );
        }

        setAnalytics(body.analytics);
      }

      if (activeTab === "settings") {
        const profileResponse = await fetch("/api/profile", {
          cache: "no-store",
        });

        const profileBody =
          await profileResponse.json();

        if (!profileResponse.ok) {
          throw new Error(
            profileBody.error ?? "Unable to load profile."
          );
        }

        const currentProfile =
          profileBody.profile as Profile | null;

        setProfile(currentProfile);
        setName(currentProfile?.name ?? "");
        setFirstName(currentProfile?.first_name ?? "");
        setLastName(currentProfile?.last_name ?? "");

        const subscriptionResponse =
          await fetch("/api/subscription", {
            cache: "no-store",
          });

        const subscriptionBody =
          await subscriptionResponse.json();

        if (!subscriptionResponse.ok) {
          throw new Error(
            subscriptionBody.error ??
              "Unable to load subscription."
          );
        }

        const loadedEntitlements = subscriptionBody.entitlements as Entitlements | null;

        setEntitlements(loadedEntitlements);
        setHasActivePaidPlan(Boolean(
          loadedEntitlements &&
            loadedEntitlements.plan &&
            loadedEntitlements.plan !== "free"
        ));
      }

      if (activeTab === "inbox") {
        const response = await fetch("/api/inboxes", {
          cache: "no-store",
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(
            body.error ??
              "Unable to load connected inboxes."
          );
        }

        const inboxes =
          (body.inboxes ?? []) as ConnectedInbox[];

        setConnectedInboxes(inboxes);

        const activeGoogleInboxes =
          inboxes.filter(
            (inbox) =>
              inbox.provider === "google" &&
              inbox.status === "active"
          );

        const currentSelectedExists = Boolean(
          selectedInboxId &&
            activeGoogleInboxes.some(
              (inbox) =>
                inbox.id === selectedInboxId
            )
        );

        const nextInboxId = currentSelectedExists
          ? selectedInboxId
          : activeGoogleInboxes[0]?.id ?? null;

        setSelectedInboxId(nextInboxId);
        setGmailInboxId(nextInboxId);

        if (
          nextInboxId &&
          nextInboxId !== selectedInboxId
        ) {
          await loadInboxMessages(nextInboxId);
        }

        if (!nextInboxId) {
          setGmailMessages([]);
          setSelectedGmailMessage(null);
        }
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to load workspace."
      );
    }
  }, [
    activeTab,
    selectedInboxId,
    loadInboxMessages,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  async function selectInbox(inboxId: string) {
    setSelectedInboxId(inboxId);
    setGmailInboxId(inboxId);
    setSelectedGmailMessage(null);
    setGmailMessages([]);
    setError(null);
    setSuccess(null);

    await loadInboxMessages(inboxId);
  }

  async function refreshInbox() {
    if (!selectedInboxId) {
      return;
    }

    await loadInboxMessages(selectedInboxId);
  }

  async function create(
    kind: "campaign" | "template"
  ) {
    setError(null);
    setSuccess(null);

    const path =
      kind === "campaign"
        ? "/api/campaigns"
        : "/api/templates";

    if (kind === "campaign") {
      if (!campaignName.trim()) {
        setError("Campaign name is requigray.");
        return;
      }

      if (!campaignTemplateId) {
        setError(
          "Please select an outreach template."
        );
        return;
      }
    }

    if (kind === "template") {
      if (!templateName.trim()) {
        setError("Template name is requigray.");
        return;
      }

      if (!templateSubject.trim()) {
        setError("Template subject is requigray.");
        return;
      }

      if (!templateBody.trim()) {
        setError("Template message is requigray.");
        return;
      }
    }

    const body =
      kind === "campaign"
        ? {
            name: campaignName.trim(),
            template_id:
              campaignTemplateId || null,
          }
        : {
            name: templateName.trim(),
            subject: templateSubject.trim(),
            body: templateBody.trim(),
          };

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result =
        await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          result?.error ??
            "Unable to create item."
        );
        return;
      }

      if (kind === "campaign") {
        setCampaignName("");
        setCampaignTemplateId("");
        setSuccess(
          "Campaign created successfully."
        );
      } else {
        setTemplateName("");
        setTemplateSubject("");
        setTemplateBody("");
        setSuccess(
          "Outreach template created successfully."
        );
      }

      void load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to create item."
      );
    }
  }

  async function updateCampaign() {
    setError(null);
    setSuccess(null);

    if (!editingCampaignId) {
      setError("Select a campaign to edit.");
      return;
    }

    if (!campaignName.trim()) {
      setError("Campaign name is requigray.");
      return;
    }

    if (!campaignTemplateId) {
      setError(
        "Please select an outreach template."
      );
      return;
    }

    try {
      const response = await fetch(
        `/api/campaigns?id=${encodeURIComponent(
          editingCampaignId
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: campaignName.trim(),
            template_id: campaignTemplateId,
          }),
        }
      );

      const body =
        await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.error ??
            "Unable to update campaign."
        );
      }

      const updatedCampaign =
        body?.campaign as Campaign | undefined;

      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === editingCampaignId
            ? updatedCampaign ?? {
                ...campaign,
                name: campaignName.trim(),
                template_id:
                  campaignTemplateId,
              }
            : campaign
        )
      );

      setCampaignName("");
      setCampaignTemplateId("");
      setEditingCampaignId(null);
      setSuccess(
        "Campaign updated successfully."
      );

      void load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to update campaign."
      );
    }
  }

  async function updateCampaignStatus(
    id: string,
    status: "active" | "paused"
  ) {
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/campaigns?id=${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const body =
        await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.error ??
            "Unable to update campaign status."
        );
      }

      const updatedCampaign =
        body?.campaign as Campaign | undefined;

      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === id
            ? updatedCampaign ?? {
                ...campaign,
                status,
              }
            : campaign
        )
      );

      setSuccess(
        status === "paused"
          ? "Campaign paused successfully."
          : "Campaign resumed successfully."
      );

      void load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to update campaign status."
      );
    }
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

      const body =
        await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.error ??
            "Unable to delete campaign."
        );
      }

      setCampaigns((current) =>
        current.filter(
          (campaign) => campaign.id !== id
        )
      );

      setSuccess(
        "Campaign deleted successfully."
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to delete campaign."
      );
    }
  }

  async function activateCampaign(id: string) {
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/campaigns?id=${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "active",
          }),
        }
      );

      const body =
        await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.error ??
            "Unable to activate campaign."
        );
      }

      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === id
            ? {
                ...campaign,
                status: "active",
              }
            : campaign
        )
      );

      setSuccess(
        "Campaign activated successfully."
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to activate campaign."
      );
    }
  }

  async function saveProfile() {
    setError(null);
    setSuccess(null);

    if (!firstName.trim()) {
      setError("First name is requigray.");
      return;
    }

    if (firstName.trim().length > 100) {
      setError(
        "First name must be 100 characters or less."
      );
      return;
    }

    if (lastName.trim().length > 100) {
      setError(
        "Last name must be 100 characters or less."
      );
      return;
    }

    if (name.trim().length > 200) {
      setError(
        "Display name must be 200 characters or less."
      );
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
          body.error ??
            "Unable to update profile."
        );
      }

      const savedProfile =
        body.profile as Profile | null;

      const updatedFirstName =
        typeof savedProfile?.first_name ===
        "string"
          ? savedProfile.first_name.trim()
          : firstName.trim();

      setProfile(savedProfile);
      setName(savedProfile?.name ?? "");
      setFirstName(
        savedProfile?.first_name ?? ""
      );
      setLastName(
        savedProfile?.last_name ?? ""
      );

      setSuccess(
        "Profile settings saved successfully."
      );

      window.dispatchEvent(
        new CustomEvent(
          "sharelite-profile-updated",
          {
            detail: {
              firstName: updatedFirstName,
            },
          }
        )
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

  function connectGoogleInbox() {
    window.location.href =
      "/api/inboxes/google/connect";
  }

  async function updateInboxStatus(
    inboxId: string,
    status: "active" | "paused"
  ) {
    setError(null);
    setSuccess(null);
    setUpdatingInboxId(inboxId);

    try {
      const response = await fetch(
        `/api/inboxes/${encodeURIComponent(
          inboxId
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const body =
        await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.error ??
            "Unable to update inbox status."
        );
      }

      setConnectedInboxes((current) =>
        current.map((inbox) =>
          inbox.id === inboxId
            ? {
                ...inbox,
                status,
              }
            : inbox
        )
      );

      setSuccess(
        status === "paused"
          ? "Inbox paused successfully."
          : "Inbox resumed successfully."
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to update inbox status."
      );
    } finally {
      setUpdatingInboxId(null);
    }
  }

  async function disconnectInbox(inboxId: string) {
    const inbox = connectedInboxes.find(
      (item) => item.id === inboxId
    );

    if (!inbox) {
      return;
    }

    const confirmed = window.confirm(
      `Disconnect ${inbox.email} from ShareLite?`
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    setUpdatingInboxId(inboxId);

    try {
      const response = await fetch(
        `/api/inboxes/${encodeURIComponent(inboxId)}/disconnect`,
        {
          method: "DELETE",
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.error ??
            "Unable to disconnect Gmail inbox."
        );
      }

      setConnectedInboxes((current) =>
        current.filter((item) => item.id !== inboxId)
      );

      if (selectedInboxId === inboxId) {
        const remaining = connectedInboxes.filter(
          (item) =>
            item.id !== inboxId &&
            item.provider === "google" &&
            item.status === "active"
        );

        const nextInboxId = remaining[0]?.id ?? null;

        setSelectedInboxId(nextInboxId);
        setGmailInboxId(nextInboxId);
        setGmailMessages([]);
        setSelectedGmailMessage(null);
      }

      setSuccess(
        `${inbox.email} disconnected successfully.`
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to disconnect Gmail inbox."
      );
    } finally {
      setUpdatingInboxId(null);
    }
  }

  async function sendGmailEmail() {
    if (!gmailInboxId) {
      setError(
        "Connect a Gmail inbox first."
      );
      return;
    }

    if (!composeTo.trim()) {
      setError(
        "Recipient email is requigray."
      );
      return;
    }

    if (!composeSubject.trim()) {
      setError("Subject is requigray.");
      return;
    }

    if (!composeBody.trim()) {
      setError("Message is requigray.");
      return;
    }

    setSendingGmail(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/inboxes/${encodeURIComponent(
          gmailInboxId
        )}/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: composeTo.trim(),
            subject: composeSubject.trim(),
            body: composeBody.trim(),
          }),
        }
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error ??
            "Unable to send Gmail message."
        );
      }

      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");

      setSuccess(
        "Email sent successfully from your Gmail inbox."
      );

      if (gmailInboxId) {
        await loadInboxMessages(gmailInboxId);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to send email."
      );
    } finally {
      setSendingGmail(false);
    }
  }

  async function replyToGmailMessage() {
    if (!gmailInboxId || !selectedGmailMessage) {
      return;
    }

    if (!composeBody.trim()) {
      setError("Reply message is requigray.");
      return;
    }

    if (!selectedGmailMessage.from) {
      setError(
        "Recipient could not be detected."
      );
      return;
    }

    setSendingGmail(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/inboxes/${encodeURIComponent(
          gmailInboxId
        )}/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: selectedGmailMessage.from,
            subject:
              selectedGmailMessage.subject ?? "",
            body: composeBody.trim(),
            threadId:
              selectedGmailMessage.threadId,
            messageId:
              selectedGmailMessage.id,
          }),
        }
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error ??
            "Unable to send reply."
        );
      }

      setComposeBody("");

      setSuccess("Reply sent successfully.");

      if (gmailInboxId) {
        await loadInboxMessages(gmailInboxId);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to send reply."
      );
    } finally {
      setSendingGmail(false);
    }
  }

  if (activeTab === "inbox") {
    const selectedInbox =
      connectedInboxes.find(
        (inbox) => inbox.id === selectedInboxId
      ) ?? null;

    const googleInboxes = connectedInboxes.filter(
      (inbox) =>
        inbox.provider === "google" &&
        inbox.status === "active"
    );

    const disconnectedGoogleInboxes = connectedInboxes.filter(
      (inbox) =>
        inbox.provider === "google" &&
        inbox.status === "disconnected"
    );

    const threadMessages = selectedGmailMessage
      ? gmailMessages
          .filter(
            (message) =>
              message.threadId === selectedGmailMessage.threadId
          )
          .sort((a, b) => {
            const aValue = Number(a.internalDate ?? 0);
            const bValue = Number(b.internalDate ?? 0);
            return aValue - bValue;
          })
      : [];

    const replyTarget =
      threadMessages[threadMessages.length - 1] ??
      selectedGmailMessage;

    const goToOverview = () => {
      onInboxBack?.();
    };

    const openCompose = () => {
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      setComposeOpen(true);
      setError(null);
      setSuccess(null);
    };

    const closeCompose = () => {
      if (sendingGmail) return;
      setComposeOpen(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
    };

    return (
      <section
        className={`min-w-0 overflow-hidden rounded-3xl border ${
          dark
            ? "border-white/[0.07] bg-[#0a0a0a]"
            : "border-slate-200 bg-slate-50"
        }`}
      >
        <div
          className={`border-b px-4 py-4 md:px-6 ${
            dark
              ? "border-white/[0.07] bg-[#0a0a0a]/95"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={goToOverview}
                aria-label="Back to Overview"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg font-black transition ${
                  dark
                    ? "border-white/[0.08] text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                ←
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      selectedInbox
                        ? "bg-gray-400"
                        : "bg-slate-500"
                    }`}
                  />
                  <h2 className="truncate text-base font-black md:text-lg">
                    Inbox
                  </h2>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {selectedInbox?.email ??
                    "Google Workspace / Gmail"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {selectedInbox && (
                <span
                  className={`hidden rounded-full px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide sm:inline-flex ${
                    dark
                      ? "bg-gray-400/10 text-gray-300"
                      : "bg-gray-50 text-gray-700"
                  }`}
                >
                  Connected
                </span>
              )}

              <button
                type="button"
                onClick={openCompose}
                disabled={!selectedInbox}
                className="rounded-xl bg-gray-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Compose
              </button>

              <button
                type="button"
                onClick={() => void refreshInbox()}
                disabled={!selectedInbox || loadingInboxMessages}
                aria-label="Refresh inbox"
                className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 md:px-4 ${
                  dark
                    ? "border-white/[0.08] bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className={loadingInboxMessages ? "animate-spin" : ""}>
                  ↻
                </span>
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {googleInboxes.length > 1 && (
            <select
              value={selectedInboxId ?? ""}
              onChange={(event) => void selectInbox(event.target.value)}
              aria-label="Select Gmail inbox"
              className={`mt-3 h-10 w-full rounded-xl border px-3 text-xs font-bold outline-none md:hidden ${
                dark
                  ? "border-white/[0.08] bg-white/[0.03] text-slate-200"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {googleInboxes.map((inbox) => (
                <option key={inbox.id} value={inbox.id}>
                  {inbox.email}
                </option>
              ))}
            </select>
          )}
        </div>

        {(error || success) && (
          <div className="px-4 pt-3 md:px-6">
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-gray-400/20 bg-gray-400/10 px-4 py-3 text-xs font-semibold text-gray-300"
              >
                {error}
                {error.includes("Reconnect Gmail") && (
                  <button
                    type="button"
                    onClick={connectGoogleInbox}
                    className="ml-3 font-black text-white underline underline-offset-2"
                  >
                    Reconnect
                  </button>
                )}
              </div>
            )}
            {!error && success && (
              <div
                role="status"
                className="rounded-xl border border-gray-400/20 bg-gray-400/10 px-4 py-3 text-xs font-semibold text-gray-300"
              >
                {success}
              </div>
            )}
          </div>
        )}

        {googleInboxes.length === 0 ? (
          <div className="p-4 md:p-6">
            <div
              className={`flex min-h-[460px] items-center justify-center rounded-2xl border p-6 ${
                dark
                  ? "border-white/[0.07] bg-white/[0.02]"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="max-w-md text-center">
                <div
                  className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl ${
                    dark
                      ? "bg-gray-400/10 text-gray-300"
                      : "bg-gray-50 text-gray-600"
                  }`}
                >
                  ✉
                </div>

                <h3 className="text-xl font-black">
                  {disconnectedGoogleInboxes.length > 0
                    ? "Reconnect your Gmail inbox"
                    : "Connect your Gmail inbox"}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {disconnectedGoogleInboxes.length > 0
                    ? "Your Google session needs to be connected again before ShareLite can read or send Gmail messages."
                    : "Connect Google Workspace or Gmail to read incoming messages and reply directly from ShareLite."}
                </p>

                <button
                  type="button"
                  onClick={connectGoogleInbox}
                  className="mt-6 rounded-xl bg-gray-600 px-5 py-3 text-xs font-black text-white transition hover:bg-gray-500"
                >
                  {disconnectedGoogleInboxes.length > 0
                    ? "Reconnect Google / Gmail"
                    : "Connect Google / Gmail"}
                </button>

                <p className="mt-4 text-[10px] text-slate-600">
                  ShareLite uses your connected account only for the email features you authorize.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 md:p-5">
            <div className="grid min-h-[620px] gap-3 xl:grid-cols-[230px_330px_minmax(0,1fr)]">
              <aside
                className={`min-w-0 overflow-hidden rounded-2xl border ${
                  dark
                    ? "border-white/[0.07] bg-white/[0.02]"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div
                  className={`border-b px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] ${
                    dark
                      ? "border-white/[0.07] text-slate-500"
                      : "border-slate-200 text-slate-400"
                  }`}
                >
                  Connected accounts
                </div>

                <div className="max-h-[570px] overflow-y-auto p-2">
                  {googleInboxes.map((inbox) => {
                    const active = inbox.id === selectedInboxId;
                    return (
                      <button
                        key={inbox.id}
                        type="button"
                        onClick={() => void selectInbox(inbox.id)}
                        className={`mb-1 w-full rounded-xl px-3 py-3 text-left transition ${
                          active
                            ? dark
                              ? "bg-gray-400/10 ring-1 ring-gray-400/20"
                              : "bg-gray-50 ring-1 ring-gray-200"
                            : dark
                              ? "hover:bg-white/[0.04]"
                              : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-500/10 text-xs font-black text-gray-400">
                            G
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-black">
                              {inbox.display_name || "Google Workspace"}
                            </div>
                            <div className="mt-0.5 truncate text-[10px] text-slate-500">
                              {inbox.email}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <section
                className={`min-w-0 overflow-hidden rounded-2xl border ${
                  dark
                    ? "border-white/[0.07] bg-white/[0.02]"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div
                  className={`flex items-center justify-between border-b px-4 py-3 ${
                    dark
                      ? "border-white/[0.07]"
                      : "border-slate-200"
                  }`}
                >
                  <div>
                    <h3 className="text-sm font-black">Inbox</h3>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {gmailMessages.length} message{gmailMessages.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  {loadingInboxMessages && (
                    <span className="text-[10px] font-black text-gray-400">
                      Syncing…
                    </span>
                  )}
                </div>

                <div className="max-h-[570px] overflow-y-auto">
                  {loadingInboxMessages ? (
                    <div className="divide-y divide-white/[0.05]">
                      {[1, 2, 3, 4, 5, 6].map((item) => (
                        <div key={item} className="animate-pulse px-4 py-5">
                          <div className="h-3 w-32 rounded bg-slate-500/15" />
                          <div className="mt-3 h-3 w-52 rounded bg-slate-500/10" />
                          <div className="mt-3 h-3 w-full rounded bg-slate-500/10" />
                        </div>
                      ))}
                    </div>
                  ) : gmailMessages.length === 0 ? (
                    <div className="flex min-h-[330px] items-center justify-center px-6 text-center">
                      <div>
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-400/10 text-xl text-gray-300">
                          ✉
                        </div>
                        <p className="text-sm font-black">No messages found</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Refresh the inbox to check Gmail again.
                        </p>
                      </div>
                    </div>
                  ) : (
                    gmailMessages.map((message) => {
                      const unread = message.labelIds?.includes("UNREAD");
                      const active = selectedGmailMessage?.id === message.id;

                      return (
                        <button
                          key={message.id}
                          type="button"
                          onClick={() => setSelectedGmailMessage(message)}
                          className={`group block w-full border-b px-4 py-4 text-left transition ${
                            dark ? "border-white/[0.05]" : "border-slate-100"
                          } ${
                            active
                              ? dark
                                ? "bg-gray-400/10"
                                : "bg-gray-50"
                              : unread
                                ? dark
                                  ? "bg-white/[0.025] hover:bg-white/[0.05]"
                                  : "bg-gray-50/30 hover:bg-gray-50/60"
                                : dark
                                  ? "hover:bg-white/[0.035]"
                                  : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                unread ? "bg-gray-400" : "bg-transparent"
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className={`truncate text-xs ${unread ? "font-black" : "font-bold"}`}>
                                  {getSenderName(message.from)}
                                </p>
                                <time className="shrink-0 text-[9px] text-slate-500">
                                  {formatMessageTime(message)}
                                </time>
                              </div>
                              <p className={`mt-1 truncate text-xs ${unread ? "font-black" : "font-semibold"}`}>
                                {message.subject || "No subject"}
                              </p>
                              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">
                                {message.snippet || message.text || "No preview available."}
                              </p>
                            </div>
                            <span className="mt-1 shrink-0 text-slate-600 transition group-hover:text-gray-400">
                              ›
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>

              <section
                className={`min-w-0 overflow-hidden rounded-2xl border ${
                  dark
                    ? "border-white/[0.07] bg-white/[0.02]"
                    : "border-slate-200 bg-white"
                }`}
              >
                {!selectedGmailMessage ? (
                  <div className="flex min-h-[570px] items-center justify-center px-8 text-center">
                    <div>
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] text-xl text-slate-500">
                        ✉
                      </div>
                      <p className="text-sm font-black">Select a message</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Choose an email to read it here.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[570px] flex-col">
                    <div
                      className={`border-b px-5 py-4 ${
                        dark ? "border-white/[0.07]" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="break-words text-base font-black md:text-lg">
                            {selectedGmailMessage.subject || "No subject"}
                          </h3>
                          <p className="mt-2 break-all text-[11px] text-slate-500">
                            From: {getSenderEmail(selectedGmailMessage.from)}
                          </p>
                          <p className="mt-1 break-all text-[11px] text-slate-500">
                            To: {selectedGmailMessage.to || selectedInbox?.email || "—"}
                          </p>
                          {selectedGmailMessage.cc && (
                            <p className="mt-1 break-all text-[11px] text-slate-500">
                              Cc: {selectedGmailMessage.cc}
                            </p>
                          )}
                        </div>
                        <time className="shrink-0 text-[10px] text-slate-500">
                          {formatMessageTime(selectedGmailMessage)}
                        </time>
                      </div>
                    </div>

                    <div
                      className={`min-h-0 flex-1 overflow-y-auto px-5 py-5 ${
                        dark ? "text-slate-300" : "text-slate-700"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words text-sm leading-7">
                        {selectedGmailMessage.text ||
                          selectedGmailMessage.snippet ||
                          "No email content available."}
                      </div>
                    </div>

                    <div
                      className={`border-t px-5 py-4 ${
                        dark ? "border-white/[0.07]" : "border-slate-200"
                      }`}
                    >
                      {replyTarget && (
                        <div className="space-y-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
                            Reply to {getSenderEmail(replyTarget.from)}
                          </div>
                          <textarea
                            value={composeBody}
                            onChange={(event) => setComposeBody(event.target.value)}
                            placeholder="Write your reply…"
                            rows={4}
                            maxLength={20000}
                            className={`w-full resize-y rounded-xl border px-3 py-3 text-sm leading-6 outline-none transition ${
                              dark
                                ? "border-white/10 bg-[#171717] text-white placeholder:text-slate-600 focus:border-gray-400"
                                : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-gray-400"
                            }`}
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => void replyToGmailMessage()}
                              disabled={sendingGmail || !composeBody.trim()}
                              className="rounded-xl bg-gray-600 px-5 py-2.5 text-xs font-black text-white transition hover:bg-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {sendingGmail ? "Sending…" : "Send reply"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {composeOpen && selectedInbox && (
          <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-3 md:items-center md:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sharelite-compose-title"
          >
            <div
              className={`w-full max-w-2xl rounded-2xl border p-5 shadow-2xl md:p-6 ${
                dark
                  ? "border-white/[0.08] bg-[#111111]"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                    New message
                  </p>
                  <h3 id="sharelite-compose-title" className="mt-1 text-lg font-black">
                    Compose email
                  </h3>
                  <p className="mt-1 truncate text-[11px] text-slate-500">
                    Sending from {selectedInbox.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCompose}
                  disabled={sendingGmail}
                  aria-label="Close compose"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-black transition disabled:opacity-50 ${
                    dark
                      ? "border-white/[0.08] text-slate-400 hover:bg-white/[0.05] hover:text-white"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  ×
                </button>
              </div>

              <div className="mt-5 grid gap-3">
                <label className="text-xs font-bold">
                  To
                  <input
                    value={composeTo}
                    onChange={(event) => setComposeTo(event.target.value)}
                    placeholder="recipient@example.com"
                    type="email"
                    autoComplete="email"
                    maxLength={320}
                    className={inputClass}
                  />
                </label>

                <label className="text-xs font-bold">
                  Subject
                  <input
                    value={composeSubject}
                    onChange={(event) => setComposeSubject(event.target.value)}
                    placeholder="Subject"
                    maxLength={300}
                    className={inputClass}
                  />
                </label>

                <label className="text-xs font-bold">
                  Message
                  <textarea
                    value={composeBody}
                    onChange={(event) => setComposeBody(event.target.value)}
                    placeholder="Write your message…"
                    rows={9}
                    maxLength={20000}
                    className={`${inputClass} h-auto resize-y py-3 leading-6`}
                  />
                </label>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeCompose}
                    disabled={sendingGmail}
                    className={`rounded-xl border px-4 py-2.5 text-xs font-black transition disabled:opacity-50 ${
                      dark
                        ? "border-white/[0.08] text-slate-300 hover:bg-white/[0.05]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendGmailEmail()}
                    disabled={
                      sendingGmail ||
                      !composeTo.trim() ||
                      !composeSubject.trim() ||
                      !composeBody.trim()
                    }
                    className="rounded-xl bg-gray-600 px-5 py-2.5 text-xs font-black text-white transition hover:bg-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingGmail ? "Sending…" : "Send message"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }
  if (activeTab === "campaigns") {
    return (
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-black">Campaigns</h2>
            <p className="text-xs text-slate-400">
              Manage your authenticated campaigns.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <details className="group">
                <summary
                  className={`flex cursor-pointer list-none items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition ${
                    dark
                      ? "border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.06]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-400/10 text-gray-300">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>
                  </span>
                  <span>
                    Gmail {selectedInbox
                      ? `${getInboxSentToday(selectedInbox)}/${getInboxLimit(selectedInbox)}`
                      : "0/100"}
                  </span>
                  <span className="text-slate-500 transition group-open:rotate-180">
                    ⌄
                  </span>
                </summary>

                <div
                  className={`absolute right-0 z-40 mt-2 w-[min(390px,calc(100vw-2rem))] rounded-2xl border p-2 shadow-2xl ${
                    dark
                      ? "border-white/10 bg-[#0a0a0a]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between px-2 py-2">
                    <div>
                      <p className="text-xs font-black">Connected Gmail</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Select an inbox or manage its connection.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={connectGoogleInbox}
                      className="rounded-lg bg-gray-500 px-2.5 py-1.5 text-[10px] font-black text-slate-950 hover:bg-gray-400"
                    >
                      + Gmail
                    </button>
                  </div>

                  <div className="mt-1 space-y-1">
                    {googleInboxes.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center">
                        <p className="text-xs font-bold">No Gmail connected</p>
                        <button
                          type="button"
                          onClick={connectGoogleInbox}
                          className="mt-2 text-[11px] font-black text-gray-300 hover:text-gray-200"
                        >
                          Connect Google / Gmail →
                        </button>
                      </div>
                    ) : (
                      googleInboxes.map((inbox) => {
                        const sentToday = getInboxSentToday(inbox);
                        const limit = getInboxLimit(inbox);
                        const isSelected = inbox.id === selectedInboxId;
                        const isUpdating = updatingInboxId === inbox.id;
                        const usage = Math.min(
                          Math.round((sentToday / limit) * 100),
                          100
                        );

                        return (
                          <div
                            key={inbox.id}
                            className={`rounded-xl border p-2 ${
                              isSelected
                                ? dark
                                  ? "border-gray-400/30 bg-gray-400/[0.06]"
                                  : "border-gray-300 bg-gray-50"
                                : dark
                                  ? "border-white/[0.06] bg-white/[0.02]"
                                  : "border-slate-200 bg-slate-50"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => void selectInbox(inbox.id)}
                              className="w-full text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-500/10 text-xs font-black text-gray-400">
                                  G
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-xs font-black">
                                      {inbox.email}
                                    </span>
                                    <span
                                      className={`shrink-0 text-[10px] font-black ${
                                        inbox.status === "active"
                                          ? "text-gray-400"
                                          : "text-gray-400"
                                      }`}
                                    >
                                      {inbox.status === "active" ? "●" : "●"}
                                    </span>
                                  </div>
                                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                                    <span>
                                      {sentToday}/{limit} sent today
                                    </span>
                                    <span>
                                      {Math.max(limit - sentToday, 0)} left
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </button>

                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                              <div
                                className="h-full rounded-full bg-gray-400 transition-all"
                                style={{ width: `${usage}%` }}
                              />
                            </div>

                            <div className="mt-2 flex justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() =>
                                  void updateInboxStatus(
                                    inbox.id,
                                    inbox.status === "active"
                                      ? "paused"
                                      : "active"
                                  )
                                }
                                className={`rounded-lg border px-2 py-1 text-[10px] font-black transition disabled:opacity-50 ${
                                  inbox.status === "active"
                                    ? "border-gray-400/30 text-gray-400 hover:bg-gray-400/10"
                                    : "border-gray-400/30 text-gray-400 hover:bg-gray-400/10"
                                }`}
                              >
                                {isUpdating
                                  ? "Updating…"
                                  : inbox.status === "active"
                                    ? "Pause"
                                    : "Resume"}
                              </button>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => void disconnectInbox(inbox.id)}
                                className="rounded-lg border border-gray-400/30 px-2 py-1 text-[10px] font-black text-gray-400 transition hover:bg-gray-400/10 disabled:opacity-50"
                              >
                                Disconnect
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </details>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingCampaignId(null);
                setCampaignName("");
                setCampaignTemplateId("");
                setError(null);
                setSuccess(null);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="rounded-xl bg-gray-600 px-4 py-2 text-xs font-black text-white transition hover:bg-gray-500"
            >
              + New Campaign
            </button>
          </div>
        </div>

        {(error || success) && (
          <div className="space-y-2">
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-gray-400/20 bg-gray-400/10 px-4 py-3 text-xs font-semibold text-gray-300"
              >
                {error}
                {error.includes("Reconnect Gmail") && (
                  <button
                    type="button"
                    onClick={connectGoogleInbox}
                    className="ml-3 font-black text-white underline underline-offset-2"
                  >
                    Reconnect
                  </button>
                )}
              </div>
            )}
            {!error && success && (
              <div
                role="status"
                className="rounded-xl border border-gray-400/20 bg-gray-400/10 px-4 py-3 text-xs font-semibold text-gray-300"
              >
                {success}
              </div>
            )}
          </div>
        )}

        <div className={card}>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="text-xs font-bold">
              Campaign name
              <input
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                placeholder="Campaign name"
                className={inputClass}
              />
            </label>

            <button
              type="button"
              onClick={() =>
                void (editingCampaignId
                  ? updateCampaign()
                  : create("campaign"))
              }
              disabled={!campaignName.trim() || !campaignTemplateId}
              className={buttonClass}
            >
              {editingCampaignId ? "Update Campaign" : "Create Campaign"}
            </button>
          </div>

          <select
            value={campaignTemplateId}
            onChange={(event) => setCampaignTemplateId(event.target.value)}
            className={`mt-3 h-11 w-full rounded-xl border px-3 text-sm ${
              dark
                ? "border-white/10 bg-[#171717] text-white"
                : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <option value="">Select outreach template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>

          {editingCampaignId && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-400">
                Editing campaign. Update the fields above and save your changes.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingCampaignId(null);
                  setCampaignName("");
                  setCampaignTemplateId("");
                  setError(null);
                  setSuccess(null);
                }}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-slate-300 hover:bg-white/[0.04]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

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
                    <span className="mt-2 inline-block text-xs font-bold uppercase text-gray-400">
                      {campaign.status}
                    </span>

                    {deliveryCounts[campaign.id] && (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                          <p className="text-[10px] text-slate-500">Pending</p>
                          <p className="text-sm font-bold text-gray-400">
                            {deliveryCounts[campaign.id].pending}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                          <p className="text-[10px] text-slate-500">Sending</p>
                          <p className="text-sm font-bold text-gray-400">
                            {deliveryCounts[campaign.id].sending}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                          <p className="text-[10px] text-slate-500">Accepted</p>
                          <p className="text-sm font-bold text-gray-400">
                            {deliveryCounts[campaign.id].accepted}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                          <p className="text-[10px] text-slate-500">Failed</p>
                          <p className="text-sm font-bold text-gray-400">
                            {deliveryCounts[campaign.id].failed}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCampaignId(campaign.id);
                        setCampaignName(campaign.name);
                        setCampaignTemplateId(campaign.template_id ?? "");
                        setError(null);
                        setSuccess(
                          "Campaign loaded above. Edit the fields and update it."
                        );
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={buttonClass}
                    >
                      Edit
                    </button>

                    {campaign.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => void activateCampaign(campaign.id)}
                        className="rounded-xl bg-gray-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-gray-400"
                      >
                        Activate
                      </button>
                    )}

                    {campaign.status === "active" && (
                      <button
                        type="button"
                        onClick={() =>
                          void updateCampaignStatus(campaign.id, "paused")
                        }
                        className="rounded-xl border border-gray-400/30 px-3 py-2 text-xs font-bold text-gray-400 transition hover:bg-gray-500/10"
                      >
                        Pause
                      </button>
                    )}

                    {campaign.status === "paused" && (
                      <button
                        type="button"
                        onClick={() =>
                          void updateCampaignStatus(campaign.id, "active")
                        }
                        className="rounded-xl border border-gray-400/30 px-3 py-2 text-xs font-bold text-gray-400 transition hover:bg-gray-500/10"
                      >
                        Resume
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        void removeCampaign(campaign.id, campaign.name)
                      }
                      className="rounded-xl border border-gray-400/30 px-3 py-2 text-xs font-bold text-gray-400 transition hover:bg-gray-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className={card}>
              <p className="text-sm text-slate-400">No campaigns yet.</p>
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
            Outreach Templates
          </h2>

          <p className="text-xs text-slate-400">
            Create reusable outreach messages
            without using an AI API.
          </p>
        </div>

        <div className={card}>
          <div className="space-y-4">
            <label className="block text-xs font-bold">
              Template name

              <input
                value={templateName}
                onChange={(e) =>
                  setTemplateName(e.target.value)
                }
                placeholder="e.g. First Contact"
                maxLength={200}
                className={inputClass}
              />
            </label>

            <label className="block text-xs font-bold">
              Subject

              <input
                value={templateSubject}
                onChange={(e) =>
                  setTemplateSubject(
                    e.target.value
                  )
                }
                placeholder="e.g. Let's connect"
                maxLength={300}
                className={inputClass}
              />
            </label>

            <label className="block text-xs font-bold">
              Message

              <textarea
                value={templateBody}
                onChange={(e) =>
                  setTemplateBody(
                    e.target.value
                  )
                }
                placeholder={`Hi [First Name],

I wanted to connect with you regarding...`}
                maxLength={20000}
                rows={8}
                className={`${inputClass} h-auto py-3`}
              />
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() =>
                  void create("template")
                }
                disabled={
                  !templateName.trim() ||
                  !templateSubject.trim() ||
                  !templateBody.trim()
                }
                className={buttonClass}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="text-sm text-gray-400"
          >
            {error}
          </p>
        )}

        {success && (
          <p className="text-sm text-gray-400">
            {success}
          </p>
        )}

        <div className="grid gap-3">
          {templates.length ? (
            templates.map((template) => (
              <div
                key={template.id}
                className={card}
              >
                <div className="flex flex-col gap-5">
                  <div className="min-w-0">
                    <h3 className="font-bold">
                      {template.name}
                    </h3>

                    <p className="mt-1 text-sm font-semibold text-gray-400">
                      {template.subject}
                    </p>

                    <p
                      className={`mt-3 whitespace-pre-wrap text-sm leading-6 ${
                        dark
                          ? "text-slate-300"
                          : "text-slate-600"
                      }`}
                    >
                      {template.body}
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setTemplateName(
                          template.name
                        );
                        setTemplateSubject(
                          template.subject
                        );
                        setTemplateBody(
                          template.body
                        );
                        setError(null);
                        setSuccess(
                          "Template loaded above. Edit the fields and save the changes."
                        );

                        window.scrollTo({
                          top: 0,
                          behavior: "smooth",
                        });
                      }}
                      className={buttonClass}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed =
                          window.confirm(
                            `Delete "${template.name}"? This action cannot be undone.`
                          );

                        if (!confirmed) {
                          return;
                        }

                        setError(null);
                        setSuccess(null);

                        try {
                          const response =
                            await fetch(
                              `/api/templates/${encodeURIComponent(
                                template.id
                              )}`,
                              {
                                method:
                                  "DELETE",
                              }
                            );

                          const body =
                            await response
                              .json()
                              .catch(
                                () => null
                              );

                          if (!response.ok) {
                            throw new Error(
                              body?.error ??
                                "Unable to delete template."
                            );
                          }

                          setTemplates(
                            (current) =>
                              current.filter(
                                (item) =>
                                  item.id !==
                                  template.id
                              )
                          );

                          setSuccess(
                            "Template deleted successfully."
                          );
                        } catch (err) {
                          setError(
                            err instanceof
                              Error
                              ? err.message
                              : "Unable to delete template."
                          );
                        }
                      }}
                      className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                        dark
                          ? "border-gray-400/20 bg-gray-400/10 text-gray-300 hover:bg-gray-400/15"
                          : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className={card}>
              <p className="text-sm text-slate-400">
                No outreach templates yet.
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Create your first reusable outreach
                message above.
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (activeTab === "analytics") {
    return (
      <section className="w-full space-y-4">
        <div>
          <h2 className="text-xl font-black">Analytics</h2>
          <p className="mt-1 text-xs text-slate-400">
            Track your outreach performance and conversion activity.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-gray-400">
            {error}
          </p>
        )}

        {analytics && (
          <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
            <div className={`${card} min-h-[112px] p-4`}>
              <div className="text-xs text-slate-400">Leads</div>
              <div className="mt-3 text-2xl font-black leading-none">
                {analytics.total}
              </div>
            </div>

            <div className={`${card} min-h-[112px] p-4`}>
              <div className="text-xs text-slate-400">Campaigns</div>
              <div className="mt-3 text-2xl font-black leading-none">
                {analytics.campaigns}
              </div>
            </div>

            <div className={`${card} min-h-[112px] p-4`}>
              <div className="text-xs text-slate-400">Converted</div>
              <div className="mt-3 text-2xl font-black leading-none">
                {analytics.converted}
              </div>
            </div>

            <div className={`${card} min-h-[112px] p-4`}>
              <div className="text-xs text-slate-400">Conversion rate</div>
              <div className="mt-3 text-2xl font-black leading-none">
                {analytics.conversionRate}%
              </div>
            </div>

            <div className={`${card} min-h-[112px] p-4 lg:col-span-1`}>
              <div className="text-xs text-slate-400">Email validation</div>
              <div
                className={`mt-2 grid grid-cols-1 gap-0.5 text-xs font-bold leading-4 ${
                  dark ? "text-white" : "text-slate-900"
                }`}
              >
                <div>unknown: {analytics.validationStatus.unknown ?? 0}</div>
                <div>valid: {analytics.validationStatus.valid ?? 0}</div>
                <div>invalid: {analytics.validationStatus.invalid ?? 0}</div>
                <div>rigray: {analytics.validationStatus.rigray ?? 0}</div>
                <div>disposable: {analytics.validationStatus.disposable ?? 0}</div>
                <div>error: {analytics.validationStatus.error ?? 0}</div>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  if (activeTab === "settings") {
    const planName = !hasActivePaidPlan
      ? "Free"
      : entitlements?.plan === "pro"
        ? "Pro"
        : entitlements?.plan === "business"
          ? "Business"
          : entitlements?.plan === "scale"
            ? "Scale"
            : entitlements?.plan === "enterprise"
              ? "Enterprise"
              : entitlements?.plan === "yearly_unlimited"
                ? "Yearly Unlimited"
                : entitlements?.plan === "ultimate_growth"
                  ? "Ultimate Growth"
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
            type="button"
            onClick={() => void saveProfile()}
            disabled={savingProfile}
            className={`mt-5 ${buttonClass}`}
          >
            {savingProfile ? "Saving..." : "Save settings"}
          </button>

          {profile && !error && success && (
            <p className="mt-3 text-xs text-gray-400">{success}</p>
          )}
        </div>

        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black">Current plan</h3>
              <p className="mt-1 text-sm font-bold text-gray-400">
                {planName} plan
              </p>
            </div>

            <a
              href="/plans"
              className="rounded-xl border border-gray-400/40 px-4 py-2 text-xs font-black text-gray-400 transition hover:bg-gray-400/10"
            >
              View plans
            </a>
          </div>

          {entitlements && (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className={`rounded-xl p-4 ${dark ? "bg-white/[0.04]" : "bg-slate-50"}`}>
                <p className="text-xs text-slate-400">Leads</p>
                <p className="mt-1 text-lg font-black">
                  {entitlements.usage.leads} / {entitlements.limits.leads}
                </p>
              </div>

              <div className={`rounded-xl p-4 ${dark ? "bg-white/[0.04]" : "bg-slate-50"}`}>
                <p className="text-xs text-slate-400">Campaigns</p>
                <p className="mt-1 text-lg font-black">
                  {entitlements.usage.campaigns} / {entitlements.limits.campaigns}
                </p>
              </div>

              <div className={`rounded-xl p-4 ${dark ? "bg-white/[0.04]" : "bg-slate-50"}`}>
                <p className="text-xs text-slate-400">Templates</p>
                <p className="mt-1 text-lg font-black">
                  {entitlements.usage.templates} / {entitlements.limits.templates}
                </p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-gray-400">
            {error}
          </p>
        )}
      </section>
    );
  }

  return null;
}