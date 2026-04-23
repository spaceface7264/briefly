"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

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

      router.push("/briefs");
      router.refresh();
    } else {
      // Signup mode - validate invite code first
      if (!inviteCode.trim()) {
        setError("Invite code is required");
        setLoading(false);
        return;
      }

      // Check if invite code is valid
      const { data: codeData } = await (supabase as any)
        .from("invite_codes")
        .select("id")
        .eq("code", inviteCode.trim().toUpperCase())
        .is("used_by", null)
        .or("expires_at.is.null,expires_at.gt.now()")
        .single();

      if (!codeData) {
        setError("Invalid or expired invite code");
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
        await (supabase as any).rpc("use_invite_code", {
          invite_code: inviteCode.trim().toUpperCase(),
          user_uuid: authData.user.id,
        });
      }

      setSuccess("Check your email to confirm your account");
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4">
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
            {mode === "login" ? "Sign in to access your briefs" : "Create your account"}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-surface border border-border rounded-lg p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "login"
                ? "bg-accent text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "signup"
                ? "bg-accent text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label
                htmlFor="inviteCode"
                className="block text-sm font-medium mb-2"
              >
                Invite Code <span className="text-error">*</span>
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                required
                className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors font-mono tracking-wider"
                placeholder="XXXX-XXXX"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-2"
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
              className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
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
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              placeholder={mode === "signup" ? "Min 6 characters" : "Your password"}
            />
          </div>

          {error && (
            <p className="text-error text-sm">{error}</p>
          )}

          {success && (
            <p className="text-success text-sm">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold rounded-lg transition-colors"
          >
            {loading
              ? mode === "login" ? "Signing in..." : "Creating account..."
              : mode === "login" ? "Sign In" : "Create Account"
            }
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          {mode === "signup"
            ? "Need an invite code? Contact your admin."
            : "This platform is invite-only."
          }
        </p>
      </div>
    </main>
  );
}
