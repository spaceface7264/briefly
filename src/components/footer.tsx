import Link from "next/link";
import { platformDetails } from "@/lib/invoicing/platform";

const platformLinks = [
  { href: "/briefs", label: "Briefs" },
  { href: "/guide", label: "Guide" },
  { href: "/profile", label: "Profile" },
];

const legalLinks = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/self-billing", label: "Self-billing agreement" },
];

export function Footer() {
  const platform = platformDetails();
  const year = new Date().getFullYear();
  const contactEmail = platform.contactEmail;

  return (
    <footer className="mt-16 border-t border-border bg-surface/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-3">
              Platform
            </p>
            <ul className="space-y-2">
              {platformLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-3">
              Legal
            </p>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-3">
              Contact
            </p>
            <a
              href={`mailto:${contactEmail}`}
              className="text-sm text-muted hover:text-foreground transition-colors break-all"
            >
              {contactEmail}
            </a>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-muted">
          <p>
            © {year} {platform.name}. All rights reserved.
          </p>
          <p className="font-mono space-x-3">
            {platform.cvr && <span>CVR {platform.cvr}</span>}
            {platform.vatNumber && <span>VAT {platform.vatNumber}</span>}
            {platform.address && <span>{platform.address}</span>}
          </p>
        </div>
      </div>
    </footer>
  );
}
