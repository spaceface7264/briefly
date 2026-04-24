"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { findNotificationType } from "@/lib/notifications";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function setNotificationPreference(
  type: string,
  enabled: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated" };

  const def = findNotificationType(type);
  if (!def) return { ok: false, error: "Unknown notification type" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !def.roles.includes(profile.role)) {
    return {
      ok: false,
      error: "This notification type does not apply to your account",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("profiles") as any)
    .update({ [def.column]: enabled })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: `Failed to save preference: ${error.message}` };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/profile");
  revalidatePath("/profile/notifications");
  return { ok: true };
}
