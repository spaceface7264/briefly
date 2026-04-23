"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

interface Props {
  profile: Profile | null;
  userEmail: string;
}

export function ProfileInfoClient({ profile, userEmail }: Props) {
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Profile</h1>
        <p className="text-muted">Update your creator information</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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

        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Display Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            placeholder="Your name"
          />
        </div>

        <div>
          <label htmlFor="instagram" className="block text-sm font-medium mb-2">
            Instagram Handle
          </label>
          <input
            id="instagram"
            type="text"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            className="w-full px-4 py-3 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            placeholder="@yourhandle"
          />
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm font-medium mb-2">
            Content Tags
          </label>
          <input
            id="tags"
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="w-full px-4 py-3 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            placeholder="reels, tutorials, comedy"
          />
          <p className="text-muted text-sm mt-1">Separate tags with commas</p>
        </div>

        {tagsInput && (
          <div>
            <label className="block text-sm font-medium mb-2">Tag Preview</label>
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

        {error && <p className="text-error text-sm">{error}</p>}

        <div className="flex items-center gap-4 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold rounded-lg transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-success text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Changes saved
            </span>
          )}
        </div>
      </form>

      <div className="mt-12 pt-8 border-t border-border">
        <button
          onClick={handleLogout}
          className="text-muted hover:text-error transition-colors text-sm"
        >
          Sign out
        </button>
      </div>
    </>
  );
}
