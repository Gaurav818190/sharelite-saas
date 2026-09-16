import { Suspense } from "react";
import VerifyEmailClient from "./VerifyEmailClient";

function VerifyEmailLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-xl">
        <p className="text-sm text-slate-300">
          Loading email verification...
        </p>
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailLoading />}>
      <VerifyEmailClient />
    </Suspense>
  );
}