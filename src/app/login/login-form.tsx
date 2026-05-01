"use client";

import { Suspense, useState } from "react";
import { PlatformLogo } from "@/components/platform-logo";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup-creator" | "signup-invite";

/**
 * Map a small set of known Supabase auth signup errors to friendlier
 * copy. Falls back to the original message verbatim for anything we
 * don't explicitly handle, so new failure modes are never silently
 * swallowed. Codes match @supabase/auth-js's ErrorCode union.
 */
function friendlySignupError(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code;
  const message = e?.message ?? "";
  const lower = message.toLowerCase();

  if (
    code === "over_email_send_rate_limit" ||
    lower.includes("email rate limit exceeded")
  ) {
    return "Too many signup attempts. Try again in an hour.";
  }

  if (
    code === "user_already_exists" ||
    lower.includes("user already registered")
  ) {
    return "An account with this email already exists. Try signing in instead.";
  }

  if (code === "weak_password" || lower.includes("password should be at least")) {
    return "Password must be at least 6 characters.";
  }

  if (
    (code === "validation_failed" && lower.includes("email")) ||
    lower.includes("invalid email") ||
    lower.includes("unable to validate email address")
  ) {
    return "That doesn't look like a valid email address.";
  }

  return message || "Signup failed. Please try again.";
}

interface LoginFormProps {
  /** True when at least one organisation has discoverable=true. When
   *  set, creator self-serve signup is allowed. When false, the only
   *  signup path is "I have an invite code". */
  allowOpenSignup: boolean;
}

export function LoginForm({ allowOpenSignup }: LoginFormProps) {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <LoginFormInner allowOpenSignup={allowOpenSignup} />
    </Suspense>
  );
}

function LoginFormInner({ allowOpenSignup }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialMode = ((): Mode => {
    const requested = searchParams.get("mode");
    if (requested === "signup" || requested === "signup-creator") {
      return allowOpenSignup ? "signup-creator" : "signup-invite";
    }
    if (requested === "signup-invite" || requested === "invite") {
      return "signup-invite";
    }
    return "login";
  })();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const isSignup = mode === "signup-creator" || mode === "signup-invite";

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setSuccess("");
  }

  async function handleLogin(supabase: ReturnType<typeof createClient>) {
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Route to the user's shell:
    //   org account → /admin
    //   creator account with at least one active membership → /briefs
    //   creator account with no membership yet → /discover (so they
    //     can apply to a discoverable org or redeem an invite)
    let nextPath = "/briefs";
    if (signInData.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", signInData.user.id)
        .maybeSingle();

      const accountType = (profile as { account_type?: string } | null)
        ?.account_type;

      if (accountType === "org") {
        nextPath = "/admin";
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
    const usingInvite = mode === "signup-invite";

    if (usingInvite && !trimmedCode) {
      setError("Invite code is required");
      setLoading(false);
      return;
    }

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
        data: usingInvite && trimmedCode ? { invite_code: trimmedCode } : undefined,
      },
    });

    if (signUpError) {
      setError(friendlySignupError(signUpError));
      setLoading(false);
      return;
    }

    // Mark invite code as used (only when one was supplied). If the
    // target org is at its creator cap, the membership trigger from
    // 0029 will raise PLAN_LIMIT_EXCEEDED — surface it so the user
    // knows to ask the admin to upgrade rather than silently
    // ending up without a membership.
    if (usingInvite && trimmedCode && authData.user) {
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
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <PlatformLogo
            className="h-12 w-auto mx-auto mb-4"
            width={180}
            height={48}
            priority
            textClassName="text-3xl font-extrabold tracking-tight"
          />
          <p className="text-muted">
            {mode === "login"
              ? "Sign in to access your briefs"
              : mode === "signup-creator"
                ? "Create your creator account"
                : "Sign up with an invite code"}
          </p>
        </div>

        {/* Top-level toggle: Sign in vs Sign up */}
        <div className="flex bg-surface border border-border rounded-lg p-1 mb-4">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "login"
                ? "bg-accent text-background font-bold"
                : "text-muted hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() =>
              switchMode(allowOpenSignup ? "signup-creator" : "signup-invite")
            }
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              isSignup
                ? "bg-accent text-background font-bold"
                : "text-muted hover:text-foreground"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Sub-toggle: which signup path */}
        {isSignup && allowOpenSignup && (
          <div className="grid grid-cols-2 gap-2 mb-6">
            <PathCard
              label="As a creator"
              description="Browse open briefs from any brand."
              selected={mode === "signup-creator"}
              onSelect={() => switchMode("signup-creator")}
            />
            <PathCard
              label="With invite code"
              description="Join a specific org as creator or teammate."
              selected={mode === "signup-invite"}
              onSelect={() => switchMode("signup-invite")}
            />
          </div>
        )}

        {isSignup && !allowOpenSignup && (
          <div className="mb-6 p-3 bg-surface border border-border rounded-lg">
            <p className="text-xs text-muted">
              This platform is currently invite-only. Ask an org admin or a
              platform admin for a code.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup-invite" && (
            <div>
              <label
                htmlFor="inviteCode"
                className="block text-sm font-medium mb-2"
              >
                Invite code <span className="text-error">*</span>
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                required
                className="w-full px-4 py-3 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors font-mono tracking-wider"
                placeholder="XXXX-XXXX"
              />
              <p className="text-muted text-xs mt-1">
                The code determines whether you join as a creator, member, or
                admin.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              className="w-full px-4 py-3 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              placeholder={
                mode === "login" ? "Your password" : "Min 6 characters"
              }
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-error-muted border border-error/30 rounded-lg p-3">
              <svg
                className="w-4 h-4 text-error shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
                />
              </svg>
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 bg-success-muted border border-success/30 rounded-lg p-3">
              <svg
                className="w-4 h-4 text-success shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="text-success text-sm">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold rounded-lg transition-colors"
          >
            {loading
              ? mode === "login"
                ? "Signing in..."
                : "Creating account..."
              : mode === "login"
                ? "Sign In"
                : mode === "signup-creator"
                  ? "Create creator account"
                  : "Redeem invite & create account"}
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          {mode === "login"
            ? allowOpenSignup
              ? "New here? Sign up to browse organisations or redeem an invite."
              : "This platform is invite-only."
            : mode === "signup-creator"
              ? "Have a code instead? Switch to \u201cWith invite code\u201d above."
              : "Don't have a code? "}
          {mode === "signup-invite" && allowOpenSignup && (
            <button
              type="button"
              onClick={() => switchMode("signup-creator")}
              className="text-accent hover:underline"
            >
              Sign up as a creator instead
            </button>
          )}
        </p>
      </div>
    </main>
  );
}

function PathCard({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left p-3 rounded-lg border transition-colors ${
        selected
          ? "border-accent bg-accent/10"
          : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      <p className="font-medium text-sm">{label}</p>
      <p className="text-xs text-muted mt-1 leading-snug">{description}</p>
    </button>
  );
}
