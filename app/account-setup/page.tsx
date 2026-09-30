import { requireAuthenticatedUser } from "@/lib/supabase-db";

export const dynamic = "force-dynamic";

function getFirstName(user: {
  user_metadata?: Record<string, unknown>;
}) {
  const firstName = user.user_metadata?.first_name;

  if (
    typeof firstName === "string" &&
    firstName.trim()
  ) {
    return firstName.trim();
  }

  const name = user.user_metadata?.name;

  if (
    typeof name === "string" &&
    name.trim()
  ) {
    return name.trim().split(/\s+/)[0];
  }

  return "User";
}

export default async function AccountSetupPage() {
  const { user } =
    await requireAuthenticatedUser();

  const displayName = getFirstName(user);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <section className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 text-3xl">
          ✨
        </div>

        <p className="text-sm font-medium text-purple-300">
          ShareLite
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
          Welcome, {displayName}
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-300">
          Your email has been verified and your
          ShareLite account is ready.
        </p>

        <a
          href="/dashboard"
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          Continue to Dashboard
        </a>
      </section>
    </main>
  );
}