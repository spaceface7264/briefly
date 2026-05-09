import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_20%_20%,rgba(9,215,215,0.16),transparent_42%),radial-gradient(circle_at_80%_80%,rgba(9,215,215,0.10),transparent_40%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/20"
      />

      <section className="relative w-full max-w-2xl rounded-3xl border border-border bg-surface/70 p-7 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-10">
        <p className="value-text mb-4 inline-flex rounded-full border border-brand-ink/30 bg-brand-muted px-3 py-1 text-xs font-semibold tracking-[0.18em] text-brand-ink uppercase">
          Route not found
        </p>

        <div className="space-y-4">
          <p className="value-text font-display text-6xl leading-none font-semibold tracking-tight text-accent-ink sm:text-7xl">
            404
          </p>
          <h1 className="font-display tracking-tight text-3xl leading-tight font-semibold sm:text-4xl">
            This hold does not exist
          </h1>
          <p className="max-w-xl text-base text-text-secondary sm:text-lg">
            The page you are looking for was moved, removed, or never published.
            Use one of the paths below to get back to active creator routes.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/briefs"
            className="inline-flex items-center justify-center rounded-full border border-accent/40 bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-hover"
          >
            Go to briefs
          </Link>
          <Link
            href="/guide"
            className="inline-flex items-center justify-center rounded-full border border-border bg-surface-raised px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-hover"
          >
            Open content guide
          </Link>
        </div>
      </section>
    </main>
  );
}
