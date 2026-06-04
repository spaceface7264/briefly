import Link from "next/link";
import { Nav } from "@/components/nav";

/**
 * Empty state shown to an onboarded creator who hasn't joined an
 * organization yet. Briefs and claims are org-scoped, so these pages
 * have nothing to list, but we keep the creator on the page they
 * clicked (instead of bouncing them to /discover) and point them at
 * the right next step.
 */
export function NoOrgState({
  heading,
  subheading,
  body,
}: {
  heading: string;
  subheading: string;
  body: string;
}) {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="font-display tracking-tight text-2xl sm:text-3xl font-bold mb-1">
              {heading}
            </h1>
            <p className="text-sm text-text-secondary">{subheading}</p>
          </div>

          <div className="bg-surface border border-border rounded-xl p-8 sm:p-12 text-center">
            <h2 className="font-display tracking-tight text-xl font-semibold mb-2">
              You haven&apos;t joined an organization yet
            </h2>
            <p className="text-text-secondary max-w-md mx-auto mb-6">{body}</p>
            <Link
              href="/discover"
              className="inline-flex px-6 py-3 bg-accent hover:bg-accent-hover text-background font-semibold rounded-full transition-colors"
            >
              Discover organizations
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
