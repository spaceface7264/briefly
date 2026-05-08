import { exitSupportMode } from "@/app/admin/super/orgs/support-actions";

interface SupportModeBannerProps {
  org: {
    id: string;
    name: string;
    logoUrl: string | null;
    accentColor: string | null;
  };
}

/**
 * Persistent strip across the top of /admin/* shown to platform admins
 * who've scoped into an org via support mode. Acts as the user-facing
 * tell that mutations write under THIS org, not the platform's own
 * context. The exit action clears profiles.support_org_id and bounces
 * the admin back to /admin/super.
 *
 * Server component, the exit form posts to a server action so we
 * don't ship hydration cost for what's mostly an audit signal.
 */
export function SupportModeBanner({ org }: SupportModeBannerProps) {
  const accent = org.accentColor ?? "#C8FF00";
  const initial = org.name.charAt(0).toUpperCase();

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 border-b border-accent/30 bg-accent/10 backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 h-9 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono uppercase tracking-[0.2em] text-accent shrink-0">
            Support mode
          </span>
          <span className="text-muted">·</span>
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-muted shrink-0">acting as</span>
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.logoUrl}
                alt=""
                aria-hidden="true"
                className="size-4 rounded object-cover shrink-0"
              />
            ) : (
              <span
                aria-hidden="true"
                className="size-4 rounded flex items-center justify-center text-[8px] font-bold text-background shrink-0"
                style={{ backgroundColor: accent }}
              >
                {initial}
              </span>
            )}
            <span className="font-semibold truncate text-foreground">
              {org.name}
            </span>
          </span>
        </div>
        <form action={exitSupportMode} className="shrink-0">
          <button
            type="submit"
            className="px-2.5 py-0.5 rounded-md bg-foreground/10 hover:bg-foreground/15 text-foreground font-medium transition-colors"
          >
            Exit support mode
          </button>
        </form>
      </div>
    </div>
  );
}
