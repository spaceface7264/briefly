import { redirect } from "next/navigation";

// Payouts moved into /profile/settings as a tab. The old URL is kept
// as a redirect so existing Stripe Connect onboarding sessions
// (whose return_url was set before the consolidation) still land on
// the right surface — the ?stripe=return search param is forwarded
// so the new settings page can refresh Stripe status on arrival.
export default async function PayoutsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>;
}) {
  const { stripe } = await searchParams;
  const target = stripe
    ? `/profile/settings?tab=payouts&stripe=${encodeURIComponent(stripe)}`
    : "/profile/settings?tab=payouts";
  redirect(target);
}
