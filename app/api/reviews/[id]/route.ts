import { NextResponse } from "next/server";
import { deleteReview, getReview, requireAuthenticatedUser, updateReview, type ReviewInput, type ReviewStatus } from "@/lib/supabase-db";

type Context = { params: Promise<{ id: string }> };
const statuses: ReviewStatus[] = ["draft", "published"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseInput(value: unknown): Partial<ReviewInput> | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const result: Partial<ReviewInput> = {};
  if (body.customer_name !== undefined) { if (typeof body.customer_name !== "string" || !body.customer_name.trim() || body.customer_name.trim().length > 200) return null; result.customer_name = body.customer_name.trim(); }
  if (body.customer_email !== undefined) { const email = typeof body.customer_email === "string" ? body.customer_email.trim().toLowerCase() : ""; if (email && (!emailPattern.test(email) || email.length > 320)) return null; result.customer_email = email || null; }
  if (body.rating !== undefined) { const rating = typeof body.rating === "number" ? body.rating : Number(body.rating); if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null; result.rating = rating; }
  if (body.title !== undefined) { if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 200) return null; result.title = body.title.trim(); }
  if (body.content !== undefined) { if (typeof body.content !== "string" || !body.content.trim() || body.content.trim().length > 5000) return null; result.content = body.content.trim(); }
  if (body.status !== undefined) { if (typeof body.status !== "string" || !statuses.includes(body.status as ReviewStatus)) return null; result.status = body.status as ReviewStatus; }
  return Object.keys(result).length ? result : null;
}

function responseError(error: unknown, message: string) {
  const unauthenticated = error instanceof Error && error.message === "UNAUTHENTICATED";
  return NextResponse.json({ error: unauthenticated ? "Authentication required." : message }, { status: unauthenticated ? 401 : 500 });
}

export async function GET(_request: Request, context: Context) {
  try {
    const { accessToken } = await requireAuthenticatedUser();
    const { id } = await context.params;
    const review = await getReview(accessToken, id);
    return review ? NextResponse.json({ review }) : NextResponse.json({ error: "Review not found." }, { status: 404 });
  } catch (error) { return responseError(error, "Unable to load review."); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { accessToken } = await requireAuthenticatedUser();
    const { id } = await context.params;
    const input = parseInput(await request.json().catch(() => null));
    if (!input) return NextResponse.json({ error: "Invalid review data." }, { status: 400 });
    const review = await updateReview(accessToken, id, input);
    return review ? NextResponse.json({ review }) : NextResponse.json({ error: "Review not found." }, { status: 404 });
  } catch (error) { return responseError(error, "Unable to update review."); }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { accessToken } = await requireAuthenticatedUser();
    const { id } = await context.params;
    return (await deleteReview(accessToken, id)) ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Review not found." }, { status: 404 });
  } catch (error) { return responseError(error, "Unable to delete review."); }
}
