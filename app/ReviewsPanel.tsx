"use client";

import { useCallback, useEffect, useState } from "react";
import type { Review, ReviewInput, ReviewStatus } from "@/lib/supabase-db";

type Props = { dark: boolean };
const emptyForm: ReviewInput = { customer_name: "", customer_email: "", rating: 5, title: "", content: "", status: "published" };

export default function ReviewsPanel({ dark }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [form, setForm] = useState<ReviewInput>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const card = `rounded-2xl border ${dark ? "border-white/[0.08] bg-white/[0.02]" : "border-slate-200 bg-white shadow-sm"}`;
  const input = "h-10 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm outline-none focus:border-cyan-400";

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/reviews", { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Unable to load reviews.");
      setReviews(Array.isArray(body?.reviews) ? body.reviews : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadReviews(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReviews]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Unable to create review.");
      setReviews((current) => [body.review, ...current]);
      setForm(emptyForm);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create review.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    const response = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null);
    if (!response.ok) { setError(body?.error ?? "Unable to delete review."); return; }
    setReviews((current) => current.filter((review) => review.id !== id));
  }

  function update<K extends keyof ReviewInput>(key: K, value: ReviewInput[K]) { setForm((current) => ({ ...current, [key]: value })); }

  return <section className="space-y-6">
    <div><h2 className="text-xl font-black">Reviews</h2><p className={`mt-1 text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>Collect and organize customer testimonials in your workspace.</p></div>
    <form onSubmit={submit} className={`${card} grid grid-cols-1 gap-3 p-5 md:grid-cols-2`}>
      <input required maxLength={200} placeholder="Customer name" value={form.customer_name} onChange={(e) => update("customer_name", e.target.value)} className={input} />
      <input type="email" maxLength={320} placeholder="Customer email (optional)" value={form.customer_email ?? ""} onChange={(e) => update("customer_email", e.target.value)} className={input} />
      <input required maxLength={200} placeholder="Review title" value={form.title} onChange={(e) => update("title", e.target.value)} className={input} />
      <select aria-label="Rating" value={form.rating} onChange={(e) => update("rating", Number(e.target.value))} className={input}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{"★".repeat(rating)} ({rating}/5)</option>)}</select>
      <textarea required maxLength={5000} placeholder="What did they say?" value={form.content} onChange={(e) => update("content", e.target.value)} className="min-h-28 rounded-xl border border-white/10 bg-[#111827] p-3 text-sm outline-none focus:border-cyan-400 md:col-span-2" />
      <div className="flex items-center justify-between md:col-span-2"><select aria-label="Review status" value={form.status} onChange={(e) => update("status", e.target.value as ReviewStatus)} className={input}><option value="published">Published</option><option value="draft">Draft</option></select><button disabled={saving} className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-black disabled:opacity-60">{saving ? "Saving…" : "Add review"}</button></div>
    </form>
    {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
    <div className="grid gap-3">{loading ? <div className={`${card} p-5 text-sm text-slate-400`}>Loading reviews…</div> : reviews.length === 0 ? <div className={`${card} p-5 text-sm text-slate-400`}>No reviews yet. Add your first customer testimonial above.</div> : reviews.map((review) => <article key={review.id} className={`${card} p-5`}><div className="flex items-start justify-between gap-4"><div><div className="text-amber-400" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}<span className="text-slate-500">{"★".repeat(5 - review.rating)}</span></div><h3 className="mt-1 font-black">{review.title}</h3><p className="text-xs text-slate-400">{review.customer_name}{review.customer_email ? ` · ${review.customer_email}` : ""}</p></div><button type="button" onClick={() => void remove(review.id)} className="rounded-lg border border-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/10">Delete</button></div><p className="mt-3 text-sm leading-6 text-slate-300">{review.content}</p><span className="mt-3 inline-block rounded-full bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-400">{review.status}</span></article>)}</div>
  </section>;
}
