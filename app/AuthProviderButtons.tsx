export function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.26Z"/><path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.29v2.53A9.75 9.75 0 0 0 12 21.75Z"/><path fill="#FBBC05" d="M6.53 13.83A5.86 5.86 0 0 1 6.22 12c0-.64.11-1.26.31-1.83V7.64H3.29A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.04 4.36l3.24-2.53Z"/><path fill="#EA4335" d="M12 6.14c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.12 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.71 5.39l3.24 2.53c.77-2.31 2.93-4.03 5.47-4.03Z"/></svg>;
}

export function GitHubIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.16c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.57-.29-5.28-1.29-5.28-5.74 0-1.27.45-2.3 1.2-3.12-.12-.3-.52-1.48.11-3.08 0 0 .98-.31 3.16 1.19A10.9 10.9 0 0 1 12 5.9c.99 0 1.98.13 2.91.38 2.18-1.5 3.16-1.19 3.16-1.19.63 1.6.23 2.78.11 3.08.75.82 1.2 1.85 1.2 3.12 0 4.46-2.72 5.45-5.3 5.73.42.36.78 1.08.78 2.18v3.23c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>;
}

export function AuthProviderButtons() {
  return <div className="mt-6 grid grid-cols-2 gap-3"><a href="/api/auth/oauth?provider=google" aria-label="Continue with Google" className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-center text-sm font-bold transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"><GoogleIcon /><span>Google</span></a><a href="/api/auth/oauth?provider=github" aria-label="Continue with GitHub" className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-center text-sm font-bold transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"><GitHubIcon /><span>GitHub</span></a></div>;
}
