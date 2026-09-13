import { NextResponse } from "next/server";
import { createReview, listReviews, requireAuthenticatedUser, type ReviewInput, type ReviewStatus } from "@/lib/supabase-db";

export const dynamic = "force-dynamic";

const statuses: ReviewStatus[] = ["draft", "published"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseInput(value: unknown, partial = false): ReviewInput | Partial<ReviewInput> | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const result: Partial<ReviewInput> = {};
  if (!partial || body.customer_name !== undefined) {
    const customerName = typeof body.customer_name === "string" ? body.customer_name.trim() : "";
    if (!customerName || customerName.length > 200) return null;
    result.customer_name = customerName;
  }
  if (body.customer_email !== undefined) {
    const email = typeof body.customer_email === "string" ? body.customer_email.trim().toLowerCase() : "";
    if (email && (!emailPattern.test(email) || email.length > 320)) return null;
    result.customer_email = email || null;
  }
  if (!partial || body.rating !== undefined) {
    const rating = typeof body.rating === "number" ? body.rating : Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
    result.rating = rating;
  }
  for (const key of ["title", "content"] as const) {
    if (!partial || body[key] !== undefined) {
      const value = typeof body[key] === "string" ? body[key].trim() : "";
      const max = key === "title" ? 200 : 5000;
      if (!value || value.length > max) return null;
      result[key] = value;
    }
  }
  if (body.status !== undefined || !partial) {
    const status = body.status === undefined ? "published" : body.status;
    if (typeof status !== "string" || !statuses.includes(status as ReviewStatus)) return null;
    result.status = status as ReviewStatus;
  }
  return Object.keys(result).length ? result : null;
}

function errorResponse(error: unknown, fallback: string) {
  const unauthenticated = error instanceof Error && error.message === "UNAUTHENTICATED";
  return NextResponse.json({ error: unauthenticated ? "Authentication required." : fallback }, { status: unauthenticated ? 401 : 500 });
}

export async function GET() {
  try {
    const { accessToken } = await requireAuthenticatedUser();
    return NextResponse.json({ reviews: await listReviews(accessToken) });
  } catch (error) {
    return errorResponse(error, "Unable to load reviews.");
  }
}

export async function POST(request: Request) {
  try {
    const { user, accessToken } = await requireAuthenticatedUser();
    const input = parseInput(await request.json().catch(() => null));
    if (!input || !("customer_name" in input) || !("rating" in input) || !("title" in input) || !("content" in input)) return NextResponse.json({ error: "Customer name, rating, title, and content are required." }, { status: 400 });
    return NextResponse.json({ review: await createReview(accessToken, user.id, input as ReviewInput) }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to create review.");
  }
}
