"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_BYTES,
  BIO_MAX,
  COUNTRIES,
  LANGUAGES,
  LANGUAGES_MAX,
  SKILLS,
  SKILLS_MAX,
} from "@/lib/creator-profile";
import {
  instagramProfileUrl,
  normalizeInstagramHandle,
} from "@/lib/instagram";
import {
  removeAvatar,
  saveCreatorProfile,
  uploadAvatar,
} from "./profile-actions";
import type { Profile } from "@/types/database";

interface Props {
  profile: Profile | null;
  userEmail: string;
}

const INPUT_CLASS =
  "w-full px-4 py-3 bg-background border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors outline-none";

export function ProfileInfoClient({ profile, userEmail }: Props) {
  const router = useRouter();

  // Avatar lives in its own state because uploads happen out-of-band
  // from the main save action — the file is too big to round-trip
  // through the JSON form.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    profile?.avatar_url ?? null
  );
  const [avatarPending, startAvatar] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile?.name ?? "");
  const [instagram, setInstagram] = useState(profile?.instagram_handle ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [country, setCountry] = useState<string | null>(
    profile?.country ?? null
  );
  const [languages, setLanguages] = useState<string[]>(
    profile?.languages ?? []
  );
  const [skills, setSkills] = useState<string[]>(profile?.skills ?? []);
  const [savePending, startSave] = useTransition();

  function pickAvatar() {
    fileInputRef.current?.click();
  }

  function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!AVATAR_ALLOWED_MIME_TYPES.has(file.type)) {
      toast.error("Avatar must be PNG, JPEG, or WebP");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Avatar must be under 2 MB");
      return;
    }

    startAvatar(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadAvatar(fd);
      if (!result.ok) {
        toast.error("Avatar upload failed", { description: result.error });
        return;
      }
      // The action revalidates server data; refresh so the canonical
      // URL flows back through props on the next render. We also
      // optimistically swap to a blob preview so the tile updates
      // before the round-trip completes.
      toast.success("Avatar updated");
      router.refresh();
    });

    // Optimistic preview while the upload + revalidate are in flight.
    const objectUrl = URL.createObjectURL(file);
    setAvatarUrl(objectUrl);
  }

  function clearAvatar() {
    startAvatar(async () => {
      const result = await removeAvatar();
      if (!result.ok) {
        toast.error("Couldn't remove avatar", { description: result.error });
        return;
      }
      setAvatarUrl(null);
      toast.success("Avatar removed");
      router.refresh();
    });
  }

  function toggleSkill(slug: string) {
    setSkills((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length < SKILLS_MAX
        ? [...prev, slug]
        : prev
    );
  }

  function toggleLanguage(code: string) {
    setLanguages((prev) =>
      prev.includes(code)
        ? prev.filter((l) => l !== code)
        : prev.length < LANGUAGES_MAX
        ? [...prev, code]
        : prev
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startSave(async () => {
      const result = await saveCreatorProfile({
        name,
        instagram,
        bio,
        country,
        languages,
        skills,
      });
      if (!result.ok) {
        toast.error("Couldn't save profile", { description: result.error });
        return;
      }
      toast.success("Profile saved");
      router.refresh();
    });
  }

  const initial =
    (name || userEmail || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Identity — avatar + display name + instagram. The fields most
          tightly tied to "who is this person" sit together so the eye
          can scan them as one block. */}
      <Card
        title="Identity"
        description="How you appear across briefs and your org's admin views."
      >
        <AvatarTile
          avatarUrl={avatarUrl}
          initial={initial}
          pending={avatarPending}
          onPick={pickAvatar}
          onClear={clearAvatar}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={onFileChosen}
        />

        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Display name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className={INPUT_CLASS}
          />
        </div>

        <InstagramField
          value={instagram}
          onChange={setInstagram}
          inputClassName={INPUT_CLASS}
        />
      </Card>

      {/* Public details — content-shaping fields that orgs match against
          when reviewing claims. Bio + Country + Languages + Skills all
          influence which briefs surface and how creators are picked. */}
      <Card
        title="Public details"
        description="What orgs see when you claim or apply to a brief."
      >
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="bio" className="block text-sm font-medium">
              Bio
            </label>
            <span className="text-xs text-muted">
              {bio.length}/{BIO_MAX}
            </span>
          </div>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
            rows={4}
            placeholder="A sentence or two about your work, style, and what you love creating."
            className={`${INPUT_CLASS} resize-y`}
          />
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-medium mb-2">
            Country
          </label>
          <select
            id="country"
            value={country ?? ""}
            onChange={(e) => setCountry(e.target.value || null)}
            className={`${INPUT_CLASS} appearance-none bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat pr-10`}
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
            }}
          >
            <option value="">Not set</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.label}
              </option>
            ))}
          </select>
        </div>

        <ChipPicker
          label="Languages"
          helper="Languages you can create content in."
          options={LANGUAGES.map((l) => ({
            value: l.code,
            label: l.label,
          }))}
          selected={languages}
          max={LANGUAGES_MAX}
          onToggle={toggleLanguage}
        />

        <ChipPicker
          label="Skills"
          helper="What you bring to a brief. Pick up to 12."
          options={SKILLS.map((s) => ({ value: s.slug, label: s.label }))}
          selected={skills}
          max={SKILLS_MAX}
          onToggle={toggleSkill}
        />
      </Card>

      {/* Account — read-only sign-in details. Sits last because it's
          the least interactive and acts as a footer reference. */}
      <Card
        title="Account"
        description="Sign-in details. Contact an admin to change them."
      >
        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            value={userEmail}
            disabled
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-muted cursor-not-allowed"
          />
        </div>
      </Card>

      <div className="flex items-center justify-end gap-4 pt-2">
        <button
          type="submit"
          disabled={savePending}
          className="px-6 py-3 bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold rounded-lg transition-colors"
        >
          {savePending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

interface CardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function Card({ title, description, children }: CardProps) {
  return (
    <section className="bg-surface border border-border rounded-xl p-6 space-y-5">
      <header>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && (
          <p className="text-muted text-sm mt-0.5">{description}</p>
        )}
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

interface AvatarTileProps {
  avatarUrl: string | null;
  initial: string;
  pending: boolean;
  onPick: () => void;
  onClear: () => void;
}

function AvatarTile({
  avatarUrl,
  initial,
  pending,
  onPick,
  onClear,
}: AvatarTileProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">Profile picture</label>
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-background">
          {avatarUrl ? (
            // Plain <img> by convention: the project keeps avatars and
            // logos out of next/image so we don't need to maintain a
            // remotePatterns allow-list for every Supabase project URL,
            // and so blob: optimistic previews work without extra
            // loader config. Same pattern as org-details-view.tsx.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Profile picture"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted">
              {initial}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onPick}
            disabled={pending}
            className="px-3 py-1.5 text-sm font-medium border border-border-strong rounded-lg hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? "Working…" : avatarUrl ? "Replace" : "Upload"}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={onClear}
              disabled={pending}
              className="px-3 py-1.5 text-sm text-muted hover:text-error disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Remove
            </button>
          )}
          <p className="text-xs text-muted sm:ml-2">
            PNG, JPEG, or WebP. Up to 2 MB.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Instagram handle field. Renders an `@` adornment inside the input
 * and (when the value resolves to a valid handle) a "Visit profile"
 * link that opens the public IG page in a new tab so creators can
 * verify they typed it correctly. Invalid input shows a soft hint
 * underneath so they fix it before saving.
 */
function InstagramField({
  value,
  onChange,
  inputClassName,
}: {
  value: string;
  onChange: (next: string) => void;
  inputClassName: string;
}) {
  const trimmed = value.trim();
  const normalized = normalizeInstagramHandle(trimmed);
  const profileUrl = normalized ? instagramProfileUrl(normalized) : null;
  const showInvalidHint = trimmed.length > 0 && !normalized;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label htmlFor="instagram" className="block text-sm font-medium">
          Instagram handle
        </label>
        {profileUrl && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            Visit profile
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 3h7v7m0-7L10 14m-7 0v7h7"
              />
            </svg>
          </a>
        )}
      </div>
      <div className="relative">
        <span
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm"
          aria-hidden
        >
          @
        </span>
        <input
          id="instagram"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="yourhandle"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={`${inputClassName} pl-8`}
        />
      </div>
      {showInvalidHint && (
        <p className="mt-1.5 text-xs text-warning">
          Use just your username — letters, numbers, periods, and underscores.
          We&apos;ll strip any @, URL, or extra spaces for you.
        </p>
      )}
    </div>
  );
}

interface ChipPickerProps {
  label: string;
  helper: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string[];
  max: number;
  onToggle: (value: string) => void;
}

function ChipPicker({
  label,
  helper,
  options,
  selected,
  max,
  onToggle,
}: ChipPickerProps) {
  const atCap = selected.length >= max;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium">{label}</label>
        <span className="text-xs text-muted">
          {selected.length}/{max}
        </span>
      </div>
      <p className="text-muted text-sm mb-3">{helper}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = selected.includes(opt.value);
          const isDisabled = !isSelected && atCap;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              disabled={isDisabled}
              aria-pressed={isSelected}
              className={
                isSelected
                  ? "px-3 py-1.5 rounded-full text-sm font-medium bg-brand-muted text-brand border border-brand/40 transition-colors"
                  : "px-3 py-1.5 rounded-full text-sm font-medium border border-border text-muted hover:border-border-strong hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
