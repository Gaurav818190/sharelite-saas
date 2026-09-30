import LandingPage from "@/app/LandingPage";
import SignupForm from "@/app/signup/SignupForm";

export default function SignupPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white">
      {/* Blurred landing page background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 scale-[1.04] blur-[7px]">
          <LandingPage />
        </div>

        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
      </div>

      {/* Authentication layer */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <SignupForm />
      </div>
    </main>
  );
}