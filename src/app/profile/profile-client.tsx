"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { createClient } from "@/lib/supabase/client";
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
