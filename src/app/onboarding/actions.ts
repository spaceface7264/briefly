"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccountType } from "@/lib/account";
import type { Database } from "@/types/database";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
import {
  BIO_MAX,
  isValidCountry,
  sanitizeLanguages,
  sanitizeSkills,
} from "@/lib/creator-profile";
import {
  isSocialPlatform,
  normalizeSocialHandle,
  socialLabel,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@/lib/socials";

type ActionResult = { ok: true } | { ok: false; error: string };

interface Gate {
  ok: true;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}

async function requireCreatorUser(): Promise<
  Gate | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const accountType = await getAccountType(supabase);
  if (accountType !== "creator") {
    return { ok: false, error: "Creator account required" };
  }
  return { ok: true, supabase, userId: user.id };
}

/**
 * Partial-update action used between onboarding steps. Each field is
 * validated independently so the user can fill in only what they want
 * at each step — anything omitted is left untouched on the profile.
 *
 * The companion `completeOnboarding` action stamps `onboarded_at` and
 * navigates; this action is fire-and-forget per step.
 */
export interface OnboardingStepInput {
  name?: string;
  bio?: string;
  city?: string | null;
  country?: string | null;
  languages?: string[];
  skills?: string[];
  socials?: Partial<Record<SocialPlatform, string>>;
}

export async function saveOnboardingStep(
  input: OnboardingStepInput
): Promise<ActionResult> {
  const gate = await requireCreatorUser();
  if (!gate.ok) return gate;

  const updates: ProfileUpdate = {};

  if (typeof input.name === "string") {
    const name = input.name.trim().slice(0, 200);
    updates.name = name || null;
  }

  if (typeof input.bio === "string") {
    const bio = input.bio.trim().slice(0, BIO_MAX);
    updates.bio = bio || null;
  }

  if ("country" in input) {
    const c = input.country;
    updates.country =
      typeof c === "string" && isValidCountry(c) ? c : null;
  }

  if ("city" in input) {
    const raw = input.city;
    if (typeof raw === "string") {
      const trimmed = raw.trim().slice(0, 100);
      updates.city = trimmed || null;
    } else {
      updates.city = null;
    }
  }

  if (input.languages !== undefined) {
    updates.languages = sanitizeLanguages(input.languages);
  }

  if (input.skills !== undefined) {
    updates.skills = sanitizeSkills(input.skills);
  }

  if (input.socials !== undefined) {
    const raw = input.socials ?? {};
    const out: Record<string, string> = {};
    for (const key of Object.keys(raw)) {
      if (!isSocialPlatform(key)) {
        return { ok: false, error: `Unknown social platform: ${key}` };
      }
    }
    for (const platform of SOCIAL_PLATFORMS) {
      const value = raw[platform];
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      const normalized = normalizeSocialHandle(platform, trimmed);
      if (!normalized) {
        return {
          ok: false,
          error: `${socialLabel(platform)} value doesn't look right.`,
        };
      }
      out[platform] = normalized;
    }
    updates.social_handles = out;
  }

  if (Object.keys(updates).length === 0) return { ok: true };

  const { error } = await gate.supabase
    .from("profiles")
    .update(updates)
    .eq("id", gate.userId);
  if (error) return { ok: false, error: `Failed to save: ${error.message}` };

  revalidatePath("/onboarding");
  return { ok: true };
}

/**
 * Mark onboarding complete and redirect. Accepts an optional final
 * step payload so the last screen's data lands in the same round-trip
 * as the completion stamp.
 *
 * Routes to /briefs unconditionally — even creators without any org
 * membership get the open-feed view there. They can still apply via
 * /discover from links inside the briefs surface.
 */
export async function completeOnboarding(
  finalStep?: OnboardingStepInput
): Promise<never> {
  const gate = await requireCreatorUser();
  if (!gate.ok) {
    redirect("/login");
  }

  if (finalStep) {
    const result = await saveOnboardingStep(finalStep);
    if (!result.ok) {
      // Re-throwing the message into the URL keeps the client simple:
      // it can read the error from the search param and re-show the
      // failing screen. In practice the client validates before
      // calling this, so this path is mostly defensive.
      redirect(`/onboarding?error=${encodeURIComponent(result.error)}`);
    }
  }

  const { error } = await gate.supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", gate.userId);
  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/briefs");
  redirect("/briefs");
}
