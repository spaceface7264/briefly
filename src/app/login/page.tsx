"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslate } from "@/lib/i18n/provider";

type Mode = "login" | "signup";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslate();
  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      router.prefetch("/briefs");
      setWelcomeOpen(true);
      window.setTimeout(() => {
        router.push("/briefs");
        router.refresh();
      }, 1750);
    } else {
      // Signup mode - validate invite code first
      if (!inviteCode.trim()) {
        setError(t("login.inviteCodeRequired"));
        setLoading(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: codeData } = await (supabase as any)
        .from("invite_codes")
        .select("id")
        .eq("code", inviteCode.trim().toUpperCase())
        .is("used_by", null)
        .or("expires_at.is.null,expires_at.gt.now()")
        .single();

      if (!codeData) {
        setError(t("login.inviteCodeInvalid"));
        setLoading(false);
        return;
      }

      // Create account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            invite_code: inviteCode.trim().toUpperCase(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Mark invite code as used
      if (authData.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).rpc("use_invite_code", {
          invite_code: inviteCode.trim().toUpperCase(),
          user_uuid: authData.user.id,
        });
      }

      setSuccess(t("login.signupCheckEmail"));
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      {welcomeOpen && <WelcomeOverlay />}
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image
            src="https://storage.googleapis.com/boulderscss/logo-flat-white.png"
            alt="Boulders"
            width={180}
            height={48}
            className="h-12 w-auto mx-auto mb-4"
            priority
          />
          <p className="text-muted">
            {mode === "login" ? t("login.subtitleLogin") : t("login.subtitleSignup")}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-surface border border-border rounded-lg p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "login"
                ? "bg-accent text-background font-bold"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t("login.modeLogin")}
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "signup"
                ? "bg-accent text-background font-bold"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t("login.modeSignup")}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label
                htmlFor="inviteCode"
                className="block text-sm font-medium mb-2"
              >
                {t("login.inviteCodeLabel")} <span className="text-error">*</span>
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                required
                className="w-full px-4 py-3 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors font-mono tracking-wider"
                placeholder={t("login.invitePlaceholder")}
              />
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-2"
            >
              {t("login.emailLabel")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              placeholder={t("login.emailPlaceholder")}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-2"
            >
              {t("login.passwordLabel")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full px-4 py-3 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              placeholder={mode === "signup" ? t("login.passwordSignupPlaceholder") : t("login.passwordLoginPlaceholder")}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-error-muted border border-error/30 rounded-lg p-3">
              <svg className="w-4 h-4 text-error shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
              </svg>
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 bg-success-muted border border-success/30 rounded-lg p-3">
              <svg className="w-4 h-4 text-success shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
              ? mode === "login" ? t("login.signingIn") : t("login.signingUp")
              : mode === "login" ? t("login.signIn") : t("login.signUp")
            }
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          {mode === "signup"
            ? t("login.footerInviteHint")
            : t("login.footerInviteOnly")
          }
        </p>
      </div>
    </main>
  );
}

function WelcomeOverlay() {
  const t = useTranslate();
  // Holds laid out as a vertical climbing route, bottom up.
  const holds = [
    { bottom: "8%", left: "38%", delay: 0 },
    { bottom: "26%", left: "60%", delay: 90 },
    { bottom: "44%", left: "32%", delay: 180 },
    { bottom: "62%", left: "58%", delay: 270 },
    { bottom: "80%", left: "44%", delay: 360 },
  ];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t("login.welcomeTitle")}
      className="welcome-overlay fixed inset-0 z-50 flex items-center justify-center bg-background overflow-hidden"
    >
      {/* Soft accent glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,_rgba(200,255,0,0.10),_transparent_55%)]"
      />
      {/* Subtle grid texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_right,_var(--color-foreground)_1px,_transparent_1px),linear-gradient(to_bottom,_var(--color-foreground)_1px,_transparent_1px)] bg-[size:40px_40px]"
      />

      <div className="relative flex flex-col items-center gap-7">
        {/* Climbing route */}
        <div
          aria-hidden="true"
          className="relative h-32 w-20"
        >
          {holds.map((hold, i) => (
            <span
              key={i}
              className="welcome-hold absolute w-2 h-2 rounded-[3px]"
              style={{
                bottom: hold.bottom,
                left: hold.left,
                animationDelay: `${hold.delay}ms`,
              }}
            />
          ))}
        </div>

        {/* Logo */}
        <Image
          src="https://storage.googleapis.com/boulderscss/logo-flat-white.png"
          alt="Boulders"
          width={220}
          height={60}
          priority
          className="welcome-logo h-12 w-auto"
        />

        {/* Text */}
        <div className="welcome-text flex flex-col items-center gap-1 text-center">
          <p className="text-base font-semibold tracking-tight">
            {t("login.welcomeTitle")}
          </p>
          <p className="text-xs text-muted">{t("login.welcomeSubtitle")}</p>
        </div>

        {/* Progress bar */}
        <div className="h-[3px] w-44 overflow-hidden rounded-full bg-border/60">
          <div className="welcome-bar-fill h-full w-full rounded-full bg-accent shadow-[0_0_12px_rgba(200,255,0,0.45)]" />
        </div>
      </div>
    </div>
  );
}
