"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { createClient } from "@/lib/supabase/client";
import { startStripeOnboarding } from "./stripe-actions";
import type { Profile } from "@/types/database";

interface Props {
  profile: Profile | null;
  userEmail: string;
}

export function ProfileClient({ profile, userEmail }: Props) {
  const router = useRouter();
  const [name, setName] = useState(profile?.name || "");
  const [instagram, setInstagram] = useState(profile?.instagram_handle || "");
  const [tagsInput, setTagsInput] = useState(profile?.tags?.join(", ") || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in");
      setSaving(false);
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase
      .from("profiles") as any)
      .update({
        name,
        instagram_handle: instagram,
        tags,
      })
      .eq("id", user.id);

    if (updateError) {
      setError("Failed to save changes");
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const payoutsEnabled = profile?.stripe_payouts_enabled ?? false;
  const hasStripeAccount = Boolean(profile?.stripe_account_id);
  const detailsSubmitted = profile?.stripe_details_submitted ?? false;

  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Profile</h1>
            <p className="text-muted">Update your creator information</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={userEmail}
                disabled
                className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-muted cursor-not-allowed"
              />
              <p className="text-muted text-sm mt-1">
                Contact an admin to change your email
              </p>
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Display Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                placeholder="Your name"
              />
            </div>

            {/* Instagram */}
            <div>
              <label
                htmlFor="instagram"
                className="block text-sm font-medium mb-2"
              >
                Instagram Handle
              </label>
              <input
                id="instagram"
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                placeholder="@yourhandle"
              />
            </div>

            {/* Tags */}
            <div>
              <label htmlFor="tags" className="block text-sm font-medium mb-2">
                Content Tags
              </label>
              <input
                id="tags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                placeholder="reels, tutorials, comedy"
              />
              <p className="text-muted text-sm mt-1">
                Separate tags with commas
              </p>
            </div>

            {/* Current Tags Preview */}
            {tagsInput && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tag Preview
                </label>
                <div className="flex flex-wrap gap-2">
                  {tagsInput
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .map((tag, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-accent-muted text-accent text-sm font-medium rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {error && (
              <p className="text-error text-sm">{error}</p>
            )}

            {/* Submit */}
            <div className="flex items-center gap-4 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold rounded-lg transition-colors"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              {saved && (
                <span className="text-success text-sm">Changes saved</span>
              )}
            </div>
          </form>

          {/* Payouts */}
          <div className="mt-12 pt-8 border-t border-border">
            <h2 className="text-xl font-bold mb-2">Payouts</h2>
            <p className="text-muted text-sm mb-4">
              Connect a Stripe payout account to receive payment for approved submissions.
            </p>
            <StripeConnectSection
              hasAccount={hasStripeAccount}
              detailsSubmitted={detailsSubmitted}
              payoutsEnabled={payoutsEnabled}
            />
          </div>

          {/* Logout */}
          <div className="mt-12 pt-8 border-t border-border">
            <button
              onClick={handleLogout}
              className="text-muted hover:text-error transition-colors text-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

function StripeConnectSection({
  hasAccount,
  detailsSubmitted,
  payoutsEnabled,
}: {
  hasAccount: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleConnect() {
    startTransition(async () => {
      await startStripeOnboarding();
    });
  }

  let statusLabel = "Not connected";
  let statusClass = "bg-muted/20 text-muted";
  let ctaLabel = "Connect payout account";

  if (payoutsEnabled) {
    statusLabel = "Payouts enabled";
    statusClass = "bg-success/20 text-success";
    ctaLabel = "Update payout details";
  } else if (hasAccount && detailsSubmitted) {
    statusLabel = "Under review";
    statusClass = "bg-warning/20 text-warning";
    ctaLabel = "Update payout details";
  } else if (hasAccount) {
    statusLabel = "Onboarding incomplete";
    statusClass = "bg-warning/20 text-warning";
    ctaLabel = "Continue onboarding";
  }

  return (
    <div className="flex items-center gap-4">
      <span
        className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusClass}`}
      >
        {statusLabel}
      </span>
      <button
        type="button"
        onClick={handleConnect}
        disabled={pending}
        className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background font-semibold rounded-lg transition-colors text-sm"
      >
        {pending ? "Redirecting..." : ctaLabel}
      </button>
    </div>
  );
}
