"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AvatarPenDialog,
  AvatarPenTile,
  SettingsCard,
  SettingsReadRow,
} from "@/components/settings-fields";
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_BYTES,
  BIO_MAX,
  COUNTRIES,
  LANGUAGES,
  LANGUAGES_MAX,
  SKILLS,
  SKILLS_MAX,
  countryLabel,
  languageLabel,
  skillLabel,
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

type Section = "identity" | "public";

export function ProfileInfoClient({ profile, userEmail }: Props) {
  const router = useRouter();

  // Avatar lives outside the section edit-mode flow because uploads
  // are direct-to-storage and immediately effective; there's no
  // "draft" state to commit alongside the rest of the form.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    profile?.avatar_url ?? null
  );
  const [avatarPending, startAvatar] = useTransition();
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
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

  // Per-section edit state. A "snapshot" lets Cancel restore the
  // pre-edit values without re-fetching, so the user gets immediate
  // feedback. Save clears the snapshot — the new values become the
  // baseline for any subsequent edit.
  const [editing, setEditing] = useState<Section | null>(null);
  const [identitySnap, setIdentitySnap] = useState<{
    name: string;
    instagram: string;
  } | null>(null);
  const [publicSnap, setPublicSnap] = useState<{
    bio: string;
    country: string | null;
    languages: string[];
    skills: string[];
  } | null>(null);
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
      toast.success("Avatar updated");
      setAvatarDialogOpen(false);
      router.refresh();
    });

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
      setAvatarDialogOpen(false);
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

  function startEditIdentity() {
    setIdentitySnap({ name, instagram });
    setEditing("identity");
  }

  function cancelEditIdentity() {
    if (identitySnap) {
      setName(identitySnap.name);
      setInstagram(identitySnap.instagram);
    }
    setIdentitySnap(null);
    setEditing(null);
  }

  function startEditPublic() {
    setPublicSnap({ bio, country, languages: [...languages], skills: [...skills] });
    setEditing("public");
  }

  function cancelEditPublic() {
    if (publicSnap) {
      setBio(publicSnap.bio);
      setCountry(publicSnap.country);
      setLanguages(publicSnap.languages);
      setSkills(publicSnap.skills);
    }
    setPublicSnap(null);
    setEditing(null);
  }

  // Single save action takes the full payload regardless of which
  // section the user is editing — the unedited section's values flow
  // through unchanged, so we don't need a per-section endpoint.
  function saveSection(section: Section) {
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
      if (section === "identity") setIdentitySnap(null);
      else setPublicSnap(null);
      setEditing(null);
      router.refresh();
    });
  }

  const initial =
    (name || userEmail || "?").trim().charAt(0).toUpperCase() || "?";

  const identityEditing = editing === "identity";
  const publicEditing = editing === "public";

  // Dirty check vs. the pre-edit snapshot so Save stays disabled
  // until the user actually changes something. Sets are compared by
  // membership (not array order) so toggling a chip off and back on
  // still counts as clean.
  const identityDirty =
    identitySnap !== null &&
    (name !== identitySnap.name || instagram !== identitySnap.instagram);
  const publicDirty =
    publicSnap !== null &&
    (bio !== publicSnap.bio ||
      country !== publicSnap.country ||
      !sameSet(languages, publicSnap.languages) ||
      !sameSet(skills, publicSnap.skills));

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Identity"
        description="How you appear across briefs and your org's admin views."
        editing={identityEditing}
        onEdit={startEditIdentity}
        onCancel={cancelEditIdentity}
        onSave={() => saveSection("identity")}
        savePending={savePending}
        disableEdit={publicEditing}
        disableSave={!identityDirty}
      >
        <AvatarPenTile
          avatarUrl={avatarUrl}
          initial={initial}
          onOpen={() => setAvatarDialogOpen(true)}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={onFileChosen}
        />
        <AvatarPenDialog
          open={avatarDialogOpen}
          onOpenChange={setAvatarDialogOpen}
          hasAvatar={Boolean(avatarUrl)}
          pending={avatarPending}
          onPick={pickAvatar}
          onClear={clearAvatar}
        />

        {identityEditing ? (
          <>
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
          </>
        ) : (
          <>
            <SettingsReadRow label="Display name" value={name || null} />
            <SettingsReadRow
              label="Instagram handle"
              value={renderInstagram(instagram)}
            />
          </>
        )}
      </SettingsCard>

      <SettingsCard
        title="Public details"
        description="What orgs see when you claim or apply to a brief."
        editing={publicEditing}
        onEdit={startEditPublic}
        onCancel={cancelEditPublic}
        onSave={() => saveSection("public")}
        savePending={savePending}
        disableEdit={identityEditing}
        disableSave={!publicDirty}
      >
        {publicEditing ? (
          <>
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
          </>
        ) : (
          <>
            <SettingsReadRow
              label="Bio"
              value={
                bio.trim() ? (
                  <p className="whitespace-pre-line">{bio}</p>
                ) : null
              }
            />
            <SettingsReadRow label="Country" value={countryLabel(country)} />
            <SettingsReadRow
              label="Languages"
              value={
                languages.length > 0 ? (
                  <ChipList items={languages.map(languageLabel)} />
                ) : null
              }
            />
            <SettingsReadRow
              label="Skills"
              value={
                skills.length > 0 ? (
                  <ChipList items={skills.map(skillLabel)} />
                ) : null
              }
            />
          </>
        )}
      </SettingsCard>

      <SettingsCard
        title="Account"
        description="Sign-in details. Contact an admin to change them."
      >
        <SettingsReadRow label="Email" value={userEmail} />
      </SettingsCard>
    </div>
  );
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

function ChipList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface-hover text-foreground border border-border"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function renderInstagram(value: string): React.ReactNode {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = normalizeInstagramHandle(trimmed);
  if (!normalized) return trimmed;
  const url = instagramProfileUrl(normalized);
  if (!url) return `@${normalized}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent hover:underline"
    >
      @{normalized}
    </a>
  );
}

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
