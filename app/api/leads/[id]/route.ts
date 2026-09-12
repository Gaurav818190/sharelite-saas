import { NextResponse } from "next/server";
import { deleteLead, requireAuthenticatedUser, updateLead, type LeadInput, type LeadStatus } from "@/lib/supabase-db";

const statuses: LeadStatus[] = ["new", "valid", "contacted", "converted"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RouteContext = { params: Promise<{ id: string }> };

function parseInput(value: unknown): Partial<LeadInput> | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const input: Partial<LeadInput> = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 200) return null;
    input.name = body.name.trim();
  }
  if (body.email !== undefined) {
    if (typeof body.email !== "string" || !emailPattern.test(body.email.trim()) || body.email.trim().length > 320) return null;
    input.email = body.email.trim().toLowerCase();
  }
  for (const field of ["company", "website", "source"] as const) {
    if (body[field] !== undefined) {
      if (body[field] !== null && typeof body[field] !== "string") return null;
      input[field] = typeof body[field] === "string" ? body[field].trim() || null : null;
    }
  }
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !statuses.includes(body.status as LeadStatus)) return null;
    input.status = body.status as LeadStatus;
  }
  return Object.keys(input).length ? input : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const input = parseInput(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "Invalid lead data." }, { status: 400 });
  try {
    const { accessToken } = await requireAuthenticatedUser();
    const lead = await updateLead(accessToken, id, input);
    if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    return NextResponse.json({ lead });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to update lead." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  try {
    const { accessToken } = await requireAuthenticatedUser();
    const deleted = await deleteLead(accessToken, id);
    if (!deleted) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to delete lead." }, { status: 500 });
  }
}
