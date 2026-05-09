import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/pricing-server";
import { PlatformNav } from "./platform-nav";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) redirect("/");

  // Resolve the data PlatformNav needs server-side so the very first
  // render already has the avatar + name (no client flash). The
  // platform shell is intentionally lighter than the org admin one,
  // it doesn't need the membership / org-branding lookups, just the
  // signed-in user's profile fields for the footer dropdown.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <PlatformNav
        userEmail={user?.email ?? ""}
        userName={profile?.name ?? null}
        userAvatarUrl={profile?.avatar_url ?? null}
      />
      <SidebarInset>
        {/* Sidebar toggle lives inside PlatformNav's SidebarHeader
            on desktop; on mobile the off-canvas drawer needs a
            visible fallback to reopen. Cap content width at ~1100px
            since tables and forms get unreadable past that. */}
        <SidebarTrigger className="md:hidden fixed top-3 left-3 z-40 bg-background/80 backdrop-blur-sm border border-border/60" />
        <div className="p-6 md:p-8 max-w-6xl w-full mx-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
