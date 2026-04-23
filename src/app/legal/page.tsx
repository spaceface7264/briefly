import Link from "next/link";
import { Nav } from "@/components/nav";
import { platformDetails } from "@/lib/invoicing/platform";

const pages = [
  {
    href: "/legal/terms",
    title: "Terms of Service",
    description:
      "The agreement between you and the platform when you create, claim, or submit briefs.",
  },
  {
    href: "/legal/privacy",
    title: "Privacy Policy",
    description:
      "What personal data we collect, why we need it, and how long we keep it.",
  },
  {
    href: "/legal/cookies",
    title: "Cookies",
    description:
      "The small number of cookies this platform sets and what each one does.",
  },
  {
    href: "/legal/self-billing",
    title: "Self-billing agreement",
    description:
      "Authorisation for Boulders to issue invoices on your behalf for approved submissions.",
  },
];

export default function LegalIndexPage() {
  const platform = platformDetails();

  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="mb-10">
            <h1 className="text-3xl font-bold mb-2">Legal</h1>
            <p className="text-muted">
              Policies, terms, and agreements that apply when you use{" "}
              {platform.name}.
            </p>
          </div>

          <ul className="space-y-3">
            {pages.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  className="group block bg-surface border border-border rounded-xl p-5 hover:border-accent/60 hover:bg-surface-hover transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-lg group-hover:text-accent transition-colors">
                        {page.title}
                      </h2>
                      <p className="text-muted text-sm mt-1">
                        {page.description}
                      </p>
                    </div>
                    <svg
                      className="w-4 h-4 text-muted group-hover:text-accent transition-colors shrink-0 mt-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
