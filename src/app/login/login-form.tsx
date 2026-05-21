"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { PlatformLogo } from "@/components/platform-logo";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const platformName = process.env.NEXT_PUBLIC_PLATFORM_NAME || "Briefly";

type Mode = "login" | "signup";

/**
 * Map a small set of known Supabase auth errors to friendlier copy.
 * Covers both `signInWithPassword` (login) and `signUp` failure modes;
 * codes are disjoint between the two flows, so one helper is enough.
 */
function friendlyAuthError(err: unknown, flow: "login" | "signup"): string {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code;
  const message = e?.message ?? "";
  const lower = message.toLowerCase();

  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    code === "over_sms_send_rate_limit" ||
    lower.includes("email rate limit exceeded") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  ) {
    return flow === "signup"
      ? "Too many signup attempts. Try again in an hour."
      : "Too many sign-in attempts. Try again in a few minutes.";
  }

  if (flow === "login") {
    if (
      code === "invalid_credentials" ||
      lower.includes("invalid login credentials")
    ) {
      return "Wrong email or password.";
    }

    if (
      code === "email_not_confirmed" ||
      lower.includes("email not confirmed")
    ) {
      return "Confirm your email first. Check your inbox for the link we sent when you signed up.";
    }

    if (code === "user_not_found" || lower.includes("user not found")) {
      return "No account found with that email. Sign up to get started.";
    }

    if (code === "user_banned" || lower.includes("banned")) {
      return "This account is suspended. Contact support if you think this is a mistake.";
    }
  }

  if (flow === "signup") {
    if (
      code === "user_already_exists" ||
      code === "email_exists" ||
      lower.includes("user already registered")
    ) {
      return "An account with this email already exists. Try signing in instead.";
    }

    if (
      code === "weak_password" ||
      lower.includes("password should be at least")
    ) {
      return "Password must be at least 6 characters.";
    }

    if (code === "signup_disabled" || lower.includes("signups not allowed")) {
      return "Self-serve signup is disabled on this platform.";
    }

    if (
      code === "email_address_invalid" ||
      (code === "validation_failed" && lower.includes("email")) ||
      lower.includes("invalid email") ||
      lower.includes("unable to validate email address")
    ) {
      return "That doesn't look like a valid email address.";
    }

    if (
      code === "email_address_not_authorized" ||
      lower.includes("email address not authorized")
    ) {
      return "This email isn't on the allow-list for this platform. Ask the admin to add you.";
    }
  }

  return (
    message ||
    (flow === "signup"
      ? "Signup failed. Please try again."
      : "Sign-in failed. Please try again.")
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <LoginFormInner />
    </Suspense>
  );
}

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialMode = ((): Mode => {
    const requested = searchParams.get("mode");
    if (
      requested === "signup" ||
      requested === "signup-creator" ||
      requested === "signup-invite" ||
      requested === "invite"
    ) {
      return "signup";
    }
    return "login";
  })();

  // Pre-fill the invite-code field (and expand it) when the user lands
  // via a legacy invite-only deep link.
  const initialInvitePrefill =
    searchParams.get("mode") === "signup-invite" ||
    searchParams.get("mode") === "invite" ||
    searchParams.get("code") ||
    "";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(
    typeof initialInvitePrefill === "string" && initialInvitePrefill !== "true"
      ? initialInvitePrefill.toUpperCase()
      : ""
  );
  const [showInvite, setShowInvite] = useState(Boolean(initialInvitePrefill));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const isSignup = mode === "signup";

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setSuccess("");
  }

  async function handleLogin(supabase: ReturnType<typeof createClient>) {
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(friendlyAuthError(signInError, "login"));
      setLoading(false);
      return;
    }

    let nextPath = "/briefs";
    if (signInData.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type, onboarded_at")
        .eq("id", signInData.user.id)
        .maybeSingle();

      const accountType = (
        profile as { account_type?: string; onboarded_at?: string | null } | null
      )?.account_type;
      const onboardedAt = (
        profile as { onboarded_at?: string | null } | null
      )?.onboarded_at;

      if (accountType === "platform") {
        nextPath = "/admin/super";
      } else if (accountType === "org") {
        nextPath = "/admin";
      } else if (!onboardedAt) {
        // First-time creator: walk through the interview before they
        // see /briefs or /discover. The interview itself stamps
        // onboarded_at, so this branch self-terminates on next sign-in.
        nextPath = "/onboarding";
      } else {
        const { count } = await supabase
          .from("memberships")
          .select("user_id", { count: "exact", head: true })
          .eq("user_id", signInData.user.id)
          .eq("status", "active");
        if (!count) {
          nextPath = "/discover";
        }
      }
    }

    router.push(nextPath);
    router.refresh();
  }

  async function handleSignup(supabase: ReturnType<typeof createClient>) {
    const trimmedCode = inviteCode.trim().toUpperCase();
    const usingInvite = trimmedCode.length > 0;

    if (usingInvite) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: codeData } = await (supabase as any)
        .from("invite_codes")
        .select("id")
        .eq("code", trimmedCode)
        .is("used_by", null)
        .or("expires_at.is.null,expires_at.gt.now()")
        .single();

      if (!codeData) {
        setError("Invalid or expired invite code");
        setLoading(false);
        return;
      }
    }

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: usingInvite ? { invite_code: trimmedCode } : undefined,
      },
    });

    if (signUpError) {
      setError(friendlyAuthError(signUpError, "signup"));
      setLoading(false);
      return;
    }

    // Mark invite code as used (only when one was supplied). If the
    // target org is at its creator cap, the membership trigger from
    // 0029 will raise PLAN_LIMIT_EXCEEDED, so surface it.
    if (usingInvite && authData.user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: redeemError } = await (supabase as any).rpc(
        "use_invite_code",
        { invite_code: trimmedCode, user_uuid: authData.user.id }
      );
      if (redeemError) {
        if (redeemError.message?.startsWith("PLAN_LIMIT_EXCEEDED:")) {
          setError(
            redeemError.message.replace(/^PLAN_LIMIT_EXCEEDED:\s*/, "") +
              " Ask the org admin to upgrade their plan."
          );
        } else {
          setError(
            `Account created but invite redemption failed: ${redeemError.message}`
          );
        }
        setLoading(false);
        return;
      }
    }

    setSuccess(
      usingInvite
        ? "Check your email to confirm. You'll be added to the org once you sign in."
        : "Check your email to confirm your account, then sign in."
    );
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const supabase = createClient();
    if (mode === "login") {
      await handleLogin(supabase);
    } else {
      await handleSignup(supabase);
    }
  }

  return (
    <main className="flex-1 grid lg:grid-cols-[1.05fr_1fr] min-h-[100svh] bg-background">
      {/* BRAND PANEL ---------------------------------------------------- */}
      <aside
        className="
          relative overflow-hidden
          border-b lg:border-b-0 lg:border-r border-border
          bg-surface/40
          px-6 sm:px-10 lg:px-14 py-10 lg:py-14
          flex flex-col
        "
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-16 size-[460px] rounded-full bg-brand/10 blur-[140px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 size-[320px] rounded-full bg-brand/8 blur-[160px]"
        />

        <div className="relative flex items-center justify-between gap-3">
          <Link
            href="/"
            className="
              inline-flex items-center gap-2 text-sm text-text-secondary
              hover:text-foreground transition-colors
            "
          >
            <ArrowLeft className="size-3.5" />
            Back home
          </Link>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted">
            {isSignup ? "Create account" : "Sign in"}
          </span>
        </div>

        <div className="relative mt-12 lg:mt-auto lg:pt-32">
          <PlatformLogo
            className="h-7 w-auto"
            width={160}
            height={40}
            priority
            textClassName="text-2xl font-extrabold tracking-tight"
          />
          <h1
            className="
              mt-8 font-display font-extrabold tracking-tight text-foreground
              text-[clamp(2rem,5vw,3.75rem)] leading-[0.95]
              max-w-[14ch]
            "
          >
            {isSignup ? (
              <>
                Start claiming{" "}
                <span className="text-brand-ink">paid briefs.</span>
              </>
            ) : (
              <>
                Welcome{" "}
                <span className="italic font-normal text-text-secondary">
                  back.
                </span>
              </>
            )}
          </h1>
          <p className="mt-5 max-w-[40ch] text-base text-text-secondary leading-relaxed">
            {isSignup
              ? `${platformName} is a paid-brief platform run by brands you already follow. Sign up, join a roster, and claim work that fits.`
              : "Pick up where you left off. Your briefs, your submissions, and your payouts are all where you left them."}
          </p>
        </div>

        <ul className="relative mt-10 hidden lg:grid gap-3 text-sm text-text-secondary max-w-[44ch]">
          {[
            {
              icon: ShieldCheck,
              text: "Funded in escrow before the brief is published.",
            },
            {
              icon: Wallet,
              text: "Payouts in DKK, transferred within seven days of approval.",
            },
            {
              icon: Sparkles,
              text: "Self-billed invoices issued for you. You never write one.",
            },
          ].map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="
                flex items-start gap-3
                rounded-2xl border border-border bg-background/40 px-4 py-3
              "
            >
              <Icon className="size-4 mt-0.5 text-brand-ink shrink-0" />
              <span className="leading-relaxed">{text}</span>
            </li>
          ))}
        </ul>

        <p className="relative mt-10 lg:mt-12 text-xs text-muted font-mono uppercase tracking-[0.18em]">
          © {new Date().getFullYear()} {platformName}
        </p>
      </aside>

      {/* FORM PANEL ----------------------------------------------------- */}
      <section className="relative flex items-center justify-center px-4 sm:px-8 py-12 lg:py-16">
        <div className="w-full max-w-[440px]">
          <header className="mb-8">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {isSignup ? "Create your account" : "Sign in"}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {isSignup
                ? "It takes about 30 seconds. We'll email you a confirmation link."
                : "Use the email and password you signed up with."}
            </p>
          </header>

          {/* Mode toggle — segmented control */}
          <div
            role="tablist"
            aria-label="Choose mode"
            className="relative grid grid-cols-2 rounded-full border border-border bg-surface/60 p-1 mb-7"
          >
            <span
              aria-hidden="true"
              className="
                absolute top-1 bottom-1 w-[calc(50%-0.25rem)]
                rounded-full bg-brand
                transition-transform duration-300 ease-out
                shadow-[0_1px_0_0_rgba(0,0,0,0.05)_inset,0_4px_18px_-6px_rgba(9,215,215,0.55)]
              "
              style={{
                transform: isSignup ? "translateX(calc(100% + 0.25rem))" : "translateX(0.25rem)",
              }}
            />
            <button
              type="button"
              role="tab"
              aria-selected={!isSignup}
              onClick={() => switchMode("login")}
              className={`
                relative z-10 h-9 rounded-full text-sm font-semibold transition-colors
                ${!isSignup ? "text-on-brand" : "text-text-secondary hover:text-foreground"}
              `}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isSignup}
              onClick={() => switchMode("signup")}
              className={`
                relative z-10 h-9 rounded-full text-sm font-semibold transition-colors
                ${isSignup ? "text-on-brand" : "text-text-secondary hover:text-foreground"}
              `}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-mono uppercase tracking-[0.16em] text-muted mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="
                  w-full h-11 px-4
                  rounded-xl border border-border bg-background/60
                  text-foreground placeholder:text-muted/70
                  hover:border-border-strong
                  focus:border-brand focus:ring-2 focus:ring-brand/30
                  outline-none transition-colors
                "
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-xs font-mono uppercase tracking-[0.16em] text-muted"
                >
                  Password
                </label>
                {isSignup && (
                  <span className="text-[11px] text-muted">
                    Min 6 characters
                  </span>
                )}
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isSignup ? "new-password" : "current-password"}
                className="
                  w-full h-11 px-4
                  rounded-xl border border-border bg-background/60
                  text-foreground placeholder:text-muted/70
                  hover:border-border-strong
                  focus:border-brand focus:ring-2 focus:ring-brand/30
                  outline-none transition-colors
                "
                placeholder={isSignup ? "Pick something memorable" : "Your password"}
              />
            </div>

            {isSignup && (
              <div className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-3.5">
                {!showInvite ? (
                  <button
                    type="button"
                    onClick={() => setShowInvite(true)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="text-sm text-text-secondary">
                      Have an invite code from an org?
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink">
                      Add it
                      <ArrowRight className="size-3" />
                    </span>
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <label
                        htmlFor="inviteCode"
                        className="block text-xs font-mono uppercase tracking-[0.16em] text-muted"
                      >
                        Invite code{" "}
                        <span className="normal-case tracking-normal text-muted/80">
                          (optional)
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowInvite(false);
                          setInviteCode("");
                        }}
                        className="text-[11px] text-muted hover:text-foreground transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      id="inviteCode"
                      type="text"
                      value={inviteCode}
                      onChange={(e) =>
                        setInviteCode(e.target.value.toUpperCase())
                      }
                      className="
                        w-full h-11 px-4
                        rounded-xl border border-border bg-background/60
                        text-foreground placeholder:text-muted/60
                        font-mono tracking-[0.18em] uppercase
                        hover:border-border-strong
                        focus:border-brand focus:ring-2 focus:ring-brand/30
                        outline-none transition-colors
                      "
                      placeholder="XXXX-XXXX"
                    />
                    <p className="text-[11px] text-muted mt-2 leading-relaxed">
                      Connects you to a specific org as creator, member, or
                      admin. If you don&rsquo;t have one, leave this blank.
                    </p>
                  </>
                )}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-error/30 bg-error-muted px-4 py-3"
              >
                <AlertCircle className="size-4 text-error-ink shrink-0 mt-0.5" />
                <p className="text-sm text-error-ink leading-relaxed">
                  {error}
                </p>
              </div>
            )}

            {success && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success-muted px-4 py-3"
              >
                <CheckCircle2 className="size-4 text-success-ink shrink-0 mt-0.5" />
                <p className="text-sm text-success-ink leading-relaxed">
                  {success}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="
                group inline-flex w-full h-12 items-center justify-center gap-2.5
                rounded-full bg-brand hover:bg-brand-hover
                disabled:opacity-60 disabled:cursor-not-allowed
                text-sm font-semibold text-on-brand
                transition-colors active:translate-y-px
              "
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {isSignup ? "Creating account" : "Signing in"}
                </>
              ) : (
                <>
                  {isSignup ? "Create account" : "Sign in"}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="text-brand-ink font-medium hover:underline underline-offset-4"
                >
                  Sign in instead
                </button>
              </>
            ) : (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="text-brand-ink font-medium hover:underline underline-offset-4"
                >
                  Create an account
                </button>
              </>
            )}
          </p>

          <p className="mt-8 text-center text-[11px] text-muted leading-relaxed">
            By continuing you agree to our{" "}
            <Link
              href="/legal/terms"
              className="underline underline-offset-2 hover:text-foreground"
            >
              terms
            </Link>{" "}
            and{" "}
            <Link
              href="/legal/privacy"
              className="underline underline-offset-2 hover:text-foreground"
            >
              privacy policy
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
