import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";
import { PlatformLogo } from "@/components/platform-logo";

const platformName = process.env.NEXT_PUBLIC_PLATFORM_NAME || "Briefly";

interface LandingNavProps {
  /**
   * Which audience the current page primarily addresses. Drives the
   * cross-link in the middle (visit the other audience's page) and the
   * primary CTA on the right (creator → sign up; brand → talk to us).
   */
  audience: "creator" | "brand";
}

/**
 * Sticky pill nav for the two marketing surfaces (/for-creators and
 * /for-brands). Both pages share this top chrome; the only difference
 * is which audience the page addresses, which flips the cross-link and
 * the primary CTA.
 */
export function LandingNav({ audience }: LandingNavProps) {
  const crossLink =
    audience === "creator"
      ? { href: "/for-brands", label: "For brands" }
      : { href: "/for-creators", label: "For creators" };

  const primaryCta =
    audience === "creator"
      ? {
          href: "/login?mode=signup",
          label: "Sign up",
        }
      : {
          href: "mailto:hello@briefly.dk?subject=Run%20paid%20briefs%20on%20Briefly",
          label: "Talk to us",
          external: true,
        };

  return (
    <header className="sticky top-3 z-40 px-3 sm:px-4">
      <div className="mx-auto max-w-6xl">
        <nav
          className="
            flex items-center gap-3 sm:gap-6
            rounded-full border border-border/80
            bg-background/70 backdrop-blur-md
            px-3 py-2 pl-4 sm:pl-5
            shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_8px_32px_-12px_rgba(0,0,0,0.4)]
          "
        >
          <Link
            href="/"
            aria-label={`${platformName} home`}
            className="flex items-center gap-2 shrink-0"
          >
            <PlatformLogo
              className="h-5 w-auto"
              width={120}
              height={28}
              priority
              textClassName="text-base font-extrabold tracking-tight"
            />
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-brand shadow-[0_0_12px_rgba(9,215,215,0.55)]"
            />
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm text-text-secondary mx-2">
            <Link
              href="/how-it-works"
              className="hover:text-foreground transition-colors"
            >
              How it works
            </Link>
            <Link
              href={crossLink.href}
              className="hover:text-foreground transition-colors"
            >
              {crossLink.label}
            </Link>
            <Link
              href="/discover"
              className="hover:text-foreground transition-colors"
            >
              Organisations
            </Link>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <ModeToggle />
            <Link
              href="/login"
              className="
                hidden sm:inline-flex h-8 items-center rounded-full px-3.5
                text-sm font-medium text-text-secondary hover:text-foreground
                transition-colors
              "
            >
              Log in
            </Link>
            {primaryCta.external ? (
              <a
                href={primaryCta.href}
                className="
                  inline-flex h-8 items-center rounded-full
                  bg-brand hover:bg-brand-hover
                  px-3.5 text-sm font-semibold text-on-brand
                  transition-colors
                  active:translate-y-px
                "
              >
                {primaryCta.label}
              </a>
            ) : (
              <Link
                href={primaryCta.href}
                className="
                  inline-flex h-8 items-center rounded-full
                  bg-brand hover:bg-brand-hover
                  px-3.5 text-sm font-semibold text-on-brand
                  transition-colors
                  active:translate-y-px
                "
              >
                {primaryCta.label}
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
