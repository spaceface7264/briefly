import Link from "next/link";
import { platformDetails } from "@/lib/invoicing/platform";
import { getT } from "@/lib/i18n/server";

export async function Footer() {
  const t = await getT();
  const platform = platformDetails();
  const year = new Date().getFullYear();
  const contactEmail =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL || "creators@boulders.dk";

  const platformLinks = [
    { href: "/briefs", label: t("nav.briefs") },
    { href: "/guide", label: t("nav.guide") },
    { href: "/profile", label: t("nav.profile") },
  ];

  const legalLinks = [
    { href: "/legal/terms", label: t("footer.terms") },
    { href: "/legal/privacy", label: t("footer.privacy") },
    { href: "/legal/cookies", label: t("footer.cookies") },
    { href: "/legal/self-billing", label: t("footer.selfBilling") },
  ];

  return (
    <footer className="mt-16 border-t border-border bg-surface/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-3">
              {t("footer.platform")}
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
              {t("footer.legal")}
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
              {t("footer.contact")}
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
            {t("footer.copyright", { year, company: platform.name })}
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
