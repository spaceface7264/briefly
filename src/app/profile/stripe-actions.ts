"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { appUrl, stripe } from "@/lib/stripe/server";

export async function startStripeOnboarding() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("stripe_account_id, email, country")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw new Error("Profile not found");
  }

  let accountId = profile.stripe_account_id;

  if (!accountId) {
    const account = await stripe().accounts.create({
      type: "express",
      country: profile.country || "DK",
      email: profile.email ?? user.email ?? undefined,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: { profile_id: user.id },
    });

    accountId = account.id;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ stripe_account_id: accountId })
      .eq("id", user.id);

    if (updateError) {
      throw new Error(`Failed to save Stripe account: ${updateError.message}`);
    }
  }

  const link = await stripe().accountLinks.create({
    account: accountId,
    refresh_url: `${await appUrl()}/profile/settings?tab=payouts&stripe=refresh`,
    return_url: `${await appUrl()}/profile/settings?tab=payouts&stripe=return`,
    type: "account_onboarding",
  });

  redirect(link.url);
}

export async function refreshStripeStatus() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_account_id) return;

  const account = await stripe().accounts.retrieve(profile.stripe_account_id);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      stripe_payouts_enabled: account.payouts_enabled ?? false,
      stripe_details_submitted: account.details_submitted ?? false,
    })
    .eq("id", user.id);

  if (updateError) {
    throw new Error(
      `Failed to refresh Stripe status: ${updateError.message}`
    );
  }
}
