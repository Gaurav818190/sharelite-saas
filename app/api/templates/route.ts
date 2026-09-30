import { NextResponse } from "next/server";

import {
  createTemplate,
  listTemplates,
} from "@/lib/supabase-workspaces";

import { requireAuthenticatedUser } from "@/lib/supabase-db";

import {
  getCurrentEntitlements,
  hasCapacity,
} from "@/lib/monetization";

type TemplateInput = {
  name: string;
  subject: string;
  body: string;
};

function parseTemplateInput(value: unknown): TemplateInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;

  if (
    typeof data.name !== "string" ||
    typeof data.subject !== "string" ||
    typeof data.body !== "string"
  ) {
    return null;
  }

  const name = data.name.trim();
  const subject = data.subject.trim();
  const body = data.body.trim();

  if (!name || name.length > 200) {
    return null;
  }

  if (!subject || subject.length > 300) {
    return null;
  }

  if (!body || body.length > 20_000) {
    return null;
  }

  return {
    name,
    subject,
    body,
  };
}

function isUnauthenticated(error: unknown) {
  return (
    error instanceof Error &&
    error.message === "UNAUTHENTICATED"
  );
}

export async function GET() {
  try {
    const { accessToken } = await requireAuthenticatedUser();

    const templates = await listTemplates(accessToken);

    return NextResponse.json({
      templates,
    });
  } catch (error) {
    if (isUnauthenticated(error)) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        error: "Unable to load templates.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, accessToken } =
      await requireAuthenticatedUser();

    const rawBody = await request.json().catch(() => null);
    const data = parseTemplateInput(rawBody);

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Invalid template data. Check the name, subject, and body.",
        },
        { status: 400 },
      );
    }

    const entitlements = await getCurrentEntitlements(
      accessToken,
      user.id,
    );

    const hasTemplateCapacity = hasCapacity(
      entitlements.plan,
      "templates",
      entitlements.usage.templates,
    );

    if (!hasTemplateCapacity) {
      return NextResponse.json(
        {
          error: "Template limit reached for your plan.",
        },
        { status: 403 },
      );
    }

    const template = await createTemplate(
      accessToken,
      user.id,
      data,
    );

    return NextResponse.json(
      {
        template,
      },
      { status: 201 },
    );
  } catch (error) {
    if (isUnauthenticated(error)) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        error: "Unable to create template.",
      },
      { status: 500 },
    );
  }
}