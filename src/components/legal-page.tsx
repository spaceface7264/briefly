import Link from "next/link";
import type { ReactNode } from "react";
import { Nav } from "./nav";

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  draft?: boolean;
  children: ReactNode;
}

export function LegalPage({
  title,
  lastUpdated,
  draft = true,
  children,
}: LegalPageProps) {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Link
            href="/legal"
            className="inline-flex items-center gap-2 text-muted hover:text-foreground mb-6 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All legal pages
          </Link>

          <div className="mb-8">
            <h1 className="font-display tracking-tight text-3xl font-bold mb-2">{title}</h1>
            <p className="text-muted text-sm font-mono">
              Last updated {lastUpdated}
            </p>
          </div>

          {draft && (
            <div className="mb-8 flex items-start gap-2.5 bg-warning-muted border border-warning/30 rounded-lg p-4">
              <svg className="w-5 h-5 text-warning-ink shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
              </svg>
              <div className="text-sm">
                <p className="font-medium mb-0.5">Working draft</p>
                <p className="text-muted">
                  This is a starting draft pending review by legal counsel.
                  The final version will replace this text before public
                  launch.
                </p>
              </div>
            </div>
          )}

          <article className="space-y-8 text-[15px] leading-relaxed">
            {children}
          </article>
        </div>
      </main>
    </>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-3 text-muted">{children}</div>
    </section>
  );
}
