"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_BYTES,
  BIO_MAX,
  COUNTRIES,
  SKILLS,
  SKILLS_MAX,
} from "@/lib/creator-profile";
import { LanguagePicker } from "@/components/language-picker";
import {
  normalizeSocialHandle,
  socialLabel,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@/lib/socials";
import { removeAvatar, uploadAvatar } from "@/app/profile/profile-actions";
import {
  completeOnboarding,
  saveOnboardingStep,
  type OnboardingStepInput,
} from "./actions";
import { PlatformLogo } from "@/components/platform-logo";

interface InitialState {
  name: string;
  avatarUrl: string | null;
  bio: string;
  city: string | null;
  country: string | null;
  languages: string[];
  skills: string[];
  socials: Partial<Record<SocialPlatform, string>>;
}

interface Props {
  initial: InitialState;
  userEmail: string;
  initialError: string | null;
}

type StepId = "welcome" | "avatar" | "place" | "skills" | "voice";

const STEPS: { id: StepId; label: string }[] = [
  { id: "welcome", label: "Welcome" },
  { id: "avatar", label: "Avatar" },
  { id: "place", label: "Place" },
  { id: "skills", label: "Skills" },
  { id: "voice", label: "Voice" },
];

const INPUT_CLASS =
  "w-full px-4 py-3 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors outline-none";

export function OnboardingClient({ initial, userEmail, initialError }: Props) {
  const router = useRouter();

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState(initial.name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl);
  const [city, setCity] = useState<string>(initial.city ?? "");
  const [country, setCountry] = useState<string | null>(initial.country);
  const [languages, setLanguages] = useState<string[]>(initial.languages);
  const [skills, setSkills] = useState<string[]>(initial.skills);
  const [bio, setBio] = useState(initial.bio);
  const [socials, setSocials] = useState<
    Partial<Record<SocialPlatform, string>>
  >(initial.socials);
  const [error, setError] = useState<string | null>(initialError);
  const [savePending, startSave] = useTransition();
  const [avatarPending, startAvatar] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentStep = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  function payloadFor(step: StepId): OnboardingStepInput {
    switch (step) {
      case "welcome":
        return { name };
      case "avatar":
        return {}; // avatar persists via its own action immediately
      case "place":
        return { city, country, languages };
      case "skills":
        return { skills };
      case "voice":
        return { bio, socials };
    }
  }

  function advance() {
    setError(null);
    if (isLast) {
      startSave(async () => {
        await completeOnboarding(payloadFor(currentStep.id));
        // completeOnboarding redirects server-side; this line only
        // runs if redirect somehow throws — leave router.refresh as
        // a belt-and-braces fallback.
        router.refresh();
      });
      return;
    }
    startSave(async () => {
      const result = await saveOnboardingStep(payloadFor(currentStep.id));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    });
  }

  function skip() {
    setError(null);
    if (isLast) {
      // Skipping the last step still completes — we don't write the
      // current step's values, but onboarded_at gets stamped so the
      // user isn't trapped here.
      startSave(async () => {
        await completeOnboarding();
        router.refresh();
      });
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function back() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function finishLater() {
    setError(null);
    // Save whatever's on the current step first so a half-completed
    // value isn't lost, then complete.
    startSave(async () => {
      await completeOnboarding(payloadFor(currentStep.id));
      router.refresh();
    });
  }

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

    // Optimistic preview so the dropzone shows the picked image while
    // the upload is in flight; the canonical URL replaces it on success.
    const objectUrl = URL.createObjectURL(file);
    setAvatarUrl(objectUrl);

    startAvatar(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadAvatar(fd);
      if (!result.ok) {
        toast.error("Avatar upload failed", { description: result.error });
        setAvatarUrl(initial.avatarUrl);
        return;
      }
      toast.success("Avatar set");
      router.refresh();
    });
  }

  function clearAvatar() {
    startAvatar(async () => {
      const result = await removeAvatar();
      if (!result.ok) {
        toast.error("Couldn't remove avatar", { description: result.error });
        return;
      }
      setAvatarUrl(null);
    });
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between border-b border-border">
        <PlatformLogo
          className="h-7 w-auto"
          width={120}
          height={28}
          textClassName="text-xl font-extrabold tracking-tight"
        />
        <button
          type="button"
          onClick={finishLater}
          disabled={savePending}
          className="text-sm text-muted hover:text-foreground transition-colors disabled:opacity-50"
        >
          Finish later
        </button>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-8 sm:py-16">
        <div className="w-full max-w-lg">
          <ProgressBar current={stepIndex} total={STEPS.length} />

          <div className="mt-10">
            {currentStep.id === "welcome" && (
              <WelcomeStep
                name={name}
                onName={setName}
                userEmail={userEmail}
              />
            )}
            {currentStep.id === "avatar" && (
              <AvatarStep
                avatarUrl={avatarUrl}
                name={name}
                userEmail={userEmail}
                pending={avatarPending}
                onPick={pickAvatar}
                onClear={clearAvatar}
              />
            )}
            {currentStep.id === "place" && (
              <PlaceStep
                city={city}
                onCity={setCity}
                country={country}
                onCountry={setCountry}
                languages={languages}
                onLanguages={setLanguages}
              />
            )}
            {currentStep.id === "skills" && (
              <SkillsStep skills={skills} onSkills={setSkills} />
            )}
            {currentStep.id === "voice" && (
              <VoiceStep
                bio={bio}
                onBio={setBio}
                socials={socials}
                onSocials={setSocials}
              />
            )}
          </div>

          {error && (
            <p className="mt-6 text-error-ink text-sm bg-error-muted border border-error/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="mt-10 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={back}
              disabled={isFirst || savePending}
              className="text-sm text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Back
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={skip}
                disabled={savePending}
                className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={advance}
                disabled={savePending}
                className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savePending ? "Saving…" : isLast ? "Finish" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onFileChosen}
      />
    </main>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round(((current + 1) / total) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-xs text-muted font-mono">
        <span>
          Step {current + 1} of {total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 bg-surface rounded-full overflow-hidden">
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StepHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="font-display tracking-tight text-3xl font-bold mb-2">
        {title}
      </h1>
      <p className="text-muted">{subtitle}</p>
    </div>
  );
}

function WelcomeStep({
  name,
  onName,
  userEmail,
}: {
  name: string;
  onName: (v: string) => void;
  userEmail: string;
}) {
  return (
    <div>
      <StepHeader
        title="Welcome aboard"
        subtitle="A few quick questions so we can match you with the right briefs. You can skip anything you'd rather come back to."
      />
      <label htmlFor="name" className="block text-sm font-medium mb-2">
        What should we call you?
      </label>
      <input
        id="name"
        type="text"
        value={name}
        onChange={(e) => onName(e.target.value)}
        placeholder="Your name"
        className={INPUT_CLASS}
        autoFocus
      />
      <p className="mt-2 text-xs text-muted">
        Signed in as {userEmail}.
      </p>
    </div>
  );
}

function AvatarStep({
  avatarUrl,
  name,
  userEmail,
  pending,
  onPick,
  onClear,
}: {
  avatarUrl: string | null;
  name: string;
  userEmail: string;
  pending: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  const initial = (name || userEmail || "?").trim().charAt(0).toUpperCase();
  return (
    <div>
      <StepHeader
        title="Add a face"
        subtitle="A photo helps brands recognise you across briefs. Skip if you'd rather stay anonymous for now."
      />
      <div className="flex flex-col items-center gap-5 py-4">
        <button
          type="button"
          onClick={onPick}
          disabled={pending}
          className="relative size-32 rounded-full border-2 border-dashed border-border hover:border-accent transition-colors overflow-hidden disabled:opacity-50"
          aria-label="Upload avatar"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <span className="flex items-center justify-center size-full text-4xl font-bold text-muted bg-surface">
              {initial}
            </span>
          )}
        </button>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={onPick}
            disabled={pending}
            className="text-accent-ink hover:underline disabled:opacity-50"
          >
            {avatarUrl ? "Change photo" : "Upload photo"}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={onClear}
              disabled={pending}
              className="text-muted hover:text-foreground disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-muted">PNG, JPEG, or WebP. Up to 2 MB.</p>
      </div>
    </div>
  );
}

function PlaceStep({
  city,
  onCity,
  country,
  onCountry,
  languages,
  onLanguages,
}: {
  city: string;
  onCity: (v: string) => void;
  country: string | null;
  onCountry: (v: string | null) => void;
  languages: string[];
  onLanguages: (v: string[]) => void;
}) {
  return (
    <div>
      <StepHeader
        title="Where are you based?"
        subtitle="Helps brands find creators in the right markets. All fields optional."
      />
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_3fr] gap-3">
        <div>
          <label htmlFor="city" className="block text-sm font-medium mb-2">
            City
          </label>
          <input
            id="city"
            type="text"
            value={city}
            onChange={(e) => onCity(e.target.value.slice(0, 100))}
            placeholder="Copenhagen"
            className={INPUT_CLASS}
            autoCapitalize="words"
          />
        </div>
        <div>
          <label htmlFor="country" className="block text-sm font-medium mb-2">
            Country
          </label>
          <select
            id="country"
            value={country ?? ""}
            onChange={(e) => onCountry(e.target.value || null)}
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
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium mb-2">
          Languages you create in
        </label>
        <LanguagePicker
          selected={languages}
          onChange={onLanguages}
          inputClassName={INPUT_CLASS}
        />
      </div>
    </div>
  );
}

function SkillsStep({
  skills,
  onSkills,
}: {
  skills: string[];
  onSkills: (v: string[]) => void;
}) {
  function toggle(slug: string) {
    if (skills.includes(slug)) {
      onSkills(skills.filter((s) => s !== slug));
    } else if (skills.length < SKILLS_MAX) {
      onSkills([...skills, slug]);
    }
  }
  return (
    <div>
      <StepHeader
        title="What do you make?"
        subtitle="Pick the things you do well. We'll surface briefs that match."
      />
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted">Pick up to {SKILLS_MAX}.</span>
        <span className="text-xs text-muted font-mono">
          {skills.length}/{SKILLS_MAX}
        </span>
      </div>
      <ChipPicker
        options={SKILLS.map((s) => ({ value: s.slug, label: s.label }))}
        selected={skills}
        max={SKILLS_MAX}
        onToggle={toggle}
      />
    </div>
  );
}

function VoiceStep({
  bio,
  onBio,
  socials,
  onSocials,
}: {
  bio: string;
  onBio: (v: string) => void;
  socials: Partial<Record<SocialPlatform, string>>;
  onSocials: (v: Partial<Record<SocialPlatform, string>>) => void;
}) {
  function setSocial(platform: SocialPlatform, value: string) {
    onSocials({ ...socials, [platform]: value });
  }
  function removeSocial(platform: SocialPlatform) {
    const next = { ...socials };
    delete next[platform];
    onSocials(next);
  }
  const visible = SOCIAL_PLATFORMS.filter(
    (p) => typeof socials[p] === "string"
  );
  const hidden = SOCIAL_PLATFORMS.filter(
    (p) => typeof socials[p] !== "string"
  );
  return (
    <div>
      <StepHeader
        title="Your voice"
        subtitle="A short bio and where to find you elsewhere. Both optional."
      />
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="bio" className="block text-sm font-medium">
            Short bio
          </label>
          <span className="text-xs text-muted">
            {bio.length}/{BIO_MAX}
          </span>
        </div>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => onBio(e.target.value.slice(0, BIO_MAX))}
          rows={3}
          placeholder="A sentence or two about your work, style, and what you love creating."
          className={`${INPUT_CLASS} resize-y`}
        />
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium mb-2">
          Social profiles
        </label>
        <div className="space-y-2">
          {visible.length === 0 ? (
            <p className="text-xs text-muted">No profiles added yet.</p>
          ) : (
            visible.map((platform) => (
              <SocialRow
                key={platform}
                platform={platform}
                value={socials[platform] ?? ""}
                onChange={(v) => setSocial(platform, v)}
                onRemove={() => removeSocial(platform)}
              />
            ))
          )}
        </div>
        {hidden.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {hidden.map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => setSocial(platform, "")}
                className="px-2.5 py-1 rounded-full text-xs font-medium border border-border text-muted hover:border-border-strong hover:text-foreground transition-colors"
              >
                + {socialLabel(platform)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SocialRow({
  platform,
  value,
  onChange,
  onRemove,
}: {
  platform: SocialPlatform;
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  const trimmed = value.trim();
  const normalized = trimmed ? normalizeSocialHandle(platform, trimmed) : null;
  const showInvalid = trimmed.length > 0 && !normalized;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-medium text-muted">
          {socialLabel(platform)}
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-muted hover:text-foreground"
        >
          Remove
        </button>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          platform === "website" ? "https://your-site.com" : "yourhandle"
        }
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className={INPUT_CLASS}
      />
      {showInvalid && (
        <p className="mt-1 text-xs text-warning">
          That doesn&apos;t look right. Use your username or full profile URL.
        </p>
      )}
    </div>
  );
}

function ChipPicker({
  options,
  selected,
  max,
  onToggle,
}: {
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string[];
  max: number;
  onToggle: (value: string) => void;
}) {
  const atCap = selected.length >= max;
  return (
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
  );
}
