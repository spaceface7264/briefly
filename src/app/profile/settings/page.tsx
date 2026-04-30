import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireCreatorAccount } from "@/lib/account";
import { ProfileInfoClient } from "../profile-info-client";
import { PayoutsClient } from "../payouts/payouts-client";
import { NotificationsClient } from "../notifications/notifications-client";
import { preferencesFromProfile } from "@/lib/notifications";
import { refreshStripeStatus } from "../stripe-actions";

export const dynamic = "force-dynamic";

type SettingsTab = "personal" | "payouts" | "notifications";

const TABS: { id: SettingsTab; label: string; description: string }[] = [
  {
    id: "personal",
    label: "Personal",
    description: "Your name, email, and password.",
  },
  {
    id: "payouts",
    label: "Payouts",
    description:
      "Billing details, Stripe Connect, and the self-billing agreement.",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Email alerts you receive from each org.",
  },
];

export default async function CreatorSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; stripe?: string }>;
}) {
  const params = await searchParams;
  const activeTab: SettingsTab =
    params.tab === "payouts" || params.tab === "notifications"
      ? params.tab
      : "personal";
  const activeTabMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Org users keep their personal info inside /admin/settings.
  await requireCreatorAccount(supabase);

  // Stripe Connect onboarding bounces back here with ?stripe=return.
  // Refresh the cached payouts state before we render the Payouts tab
  // so the badge reflects the latest connect status without a refresh.
  if (params.stripe === "return") {
    try {
      await refreshStripeStatus();
    } catch (err) {
      console.error("Failed to refresh Stripe status:", err);
    }
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error) {
    console.error("Error fetching profile:", error);
  }

  const preferences = preferencesFromProfile(profile ?? {});

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted">{activeTabMeta.description}</p>
      </div>

      {/* Tab strip. Search-param state (?tab=payouts, ?tab=notifications)
          so each tab is linkable and survives refresh. Default tab
          omits the param entirely to keep the canonical URL clean. */}
      <div className="mb-8 border-b border-border">
        <nav className="flex gap-1 -mb-px" aria-label="Settings sections">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            const href =
              tab.id === "personal"
                ? "/profile/settings"
                : `/profile/settings?tab=${tab.id}`;
            return (
              <Link
                key={tab.id}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted hover:text-foreground hover:border-border"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {activeTab === "personal" && (
        <ProfileInfoClient profile={profile} userEmail={user.email || ""} />
      )}
      {activeTab === "payouts" && <PayoutsClient profile={profile} />}
      {activeTab === "notifications" && (
        <NotificationsClient preferences={preferences} />
      )}
    </div>
  );
}
