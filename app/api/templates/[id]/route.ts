import { NextResponse } from "next/server";

import {
  deleteTemplate,
  getTemplate,
  updateTemplate,
} from "@/lib/supabase-workspaces";

import { requireAuthenticatedUser } from "@/lib/supabase-db";

type Context = {
  params: Promise<{ id: string }>;
};

type TemplateUpdate = {
  name?: string;
  subject?: string;
  body?: string;
};

function parseTemplateInput(value: unknown): TemplateUpdate | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;
  const result: TemplateUpdate = {};

  if (data.name !== undefined) {
    if (
      typeof data.name !== "string" ||
      !data.name.trim() ||
      data.name.trim().length > 200
    ) {
      return null;
    }

    result.name = data.name.trim();
  }

  if (data.subject !== undefined) {
    if (
      typeof data.subject !== "string" ||
      !data.subject.trim() ||
      data.subject.trim().length > 300
    ) {
      return null;
    }

    result.subject = data.subject.trim();
  }

  if (data.body !== undefined) {
    if (
      typeof data.body !== "string" ||
      !data.body.trim() ||
      data.body.trim().length > 20_000
    ) {
      return null;
    }

    result.body = data.body.trim();
  }

  if (Object.keys(result).length === 0) {
    return null;
  }

  return result;
}

function isUnauthenticated(error: unknown) {
  return (
    error instanceof Error &&
    error.message === "UNAUTHENTICATED"
  );
}

function getErrorStatus(error: unknown) {
  return isUnauthenticated(error) ? 401 : 500;
}

export async function GET(
  _request: Request,
  context: Context,
) {
  try {
    const { accessToken } =
      await requireAuthenticatedUser();

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        {
          error: "Template ID is required.",
        },
        { status: 400 },
      );
    }

    const template = await getTemplate(
      accessToken,
      id,
    );

    if (!template) {
      return NextResponse.json(
        {
          error: "Template not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      template,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: isUnauthenticated(error)
          ? "Authentication required."
          : "Unable to load template.",
      },
      {
        status: getErrorStatus(error),
      },
    );
  }
}

export async function PATCH(
  request: Request,
  context: Context,
) {
  try {
    const { accessToken } =
      await requireAuthenticatedUser();

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        {
          error: "Template ID is required.",
        },
        { status: 400 },
      );
    }

    const rawBody = await request
      .json()
      .catch(() => null);

    const data = parseTemplateInput(rawBody);

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Invalid template data. Provide at least one valid field.",
        },
        { status: 400 },
      );
    }

    const template = await updateTemplate(
      accessToken,
      id,
      data,
    );

    if (!template) {
      return NextResponse.json(
        {
          error: "Template not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      template,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: isUnauthenticated(error)
          ? "Authentication required."
          : "Unable to update template.",
      },
      {
        status: getErrorStatus(error),
      },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: Context,
) {
  try {
    const { accessToken } =
      await requireAuthenticatedUser();

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        {
          error: "Template ID is required.",
        },
        { status: 400 },
      );
    }

    const deleted = await deleteTemplate(
      accessToken,
      id,
    );

    if (!deleted) {
      return NextResponse.json(
        {
          error: "Template not found.",
        },
        { status: 404 },
      );
    }

    return new NextResponse(null, {
      status: 204,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: isUnauthenticated(error)
          ? "Authentication required."
          : "Unable to delete template.",
      },
      {
        status: getErrorStatus(error),
      },
    );
  }
}