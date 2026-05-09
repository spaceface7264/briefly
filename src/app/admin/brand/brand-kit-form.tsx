"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  removeBrandLogo,
  removeGuidelines,
  saveBrandKit,
  setGuidelinesUrl,
  uploadBrandLogo,
  uploadGuidelinesFile,
} from "./actions";
import {
  COLORS_MAX,
  NOTES_MAX,
  TYPOGRAPHY_MAX,
  type BrandColor,
  type BrandTypography,
  type BrandTypographyRole,
  type LogoSlot,
} from "./types";

const LOGO_SLOTS: Array<{
  slot: LogoSlot;
  label: string;
  hint: string;
}> = [
  { slot: "mark", label: "Logo mark", hint: "Square icon or symbol" },
  { slot: "dark", label: "On dark", hint: "Logo for dark backgrounds" },
  { slot: "light", label: "On light", hint: "Logo for light backgrounds" },
];

const ROLE_OPTIONS: Array<{ value: BrandTypographyRole; label: string }> = [
  { value: "heading", label: "Heading" },
  { value: "body", label: "Body" },
  { value: "mono", label: "Mono" },
  { value: "accent", label: "Accent" },
];

interface Props {
  canEdit: boolean;
  initial: {
    logos: Record<LogoSlot, string | null>;
    colors: BrandColor[];
    typography: BrandTypography[];
    guidelines: { url: string | null; isExternal: boolean };
    notes: string;
  };
}

export function BrandKitForm({ canEdit, initial }: Props) {
  const router = useRouter();

  const [colors, setColors] = useState<BrandColor[]>(initial.colors);
  const [typography, setTypography] = useState<BrandTypography[]>(
    initial.typography
  );
  const [notes, setNotes] = useState<string>(initial.notes);
  const [pendingSave, startSave] = useTransition();

  function handleSave() {
    startSave(async () => {
      const result = await saveBrandKit({
        colors,
        typography,
        notes,
      });
      if (!result.ok) {
        toast.error("Couldn't save brand kit", { description: result.error });
        return;
      }
      toast.success("Brand kit saved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-10">
      {!canEdit && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          You&apos;re viewing the brand kit as a member. Ask an admin in
          your org if you need to make changes.
        </div>
      )}

      <LogosSection canEdit={canEdit} initialLogos={initial.logos} />

      <ColorsSection
        canEdit={canEdit}
        colors={colors}
        setColors={setColors}
      />

      <TypographySection
        canEdit={canEdit}
        typography={typography}
        setTypography={setTypography}
      />

      <GuidelinesSection
        canEdit={canEdit}
        initial={initial.guidelines}
      />

      <NotesSection canEdit={canEdit} notes={notes} setNotes={setNotes} />

      {canEdit && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={handleSave}
            disabled={pendingSave}
            className="px-4 py-2 bg-accent text-background font-semibold rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors text-sm"
          >
            {pendingSave ? "Saving…" : "Save palette, typography, notes"}
          </button>
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted">{description}</p>
    </div>
  );
}

function LogosSection({
  canEdit,
  initialLogos,
}: {
  canEdit: boolean;
  initialLogos: Record<LogoSlot, string | null>;
}) {
  return (
    <section className="space-y-4">
      <SectionHeader
        title="Logos"
        description="Variants beyond your primary org logo. Used by creators in deliverables and decks."
      />
      <div className="grid sm:grid-cols-3 gap-4">
        {LOGO_SLOTS.map((entry) => (
          <LogoTile
            key={entry.slot}
            slot={entry.slot}
            label={entry.label}
            hint={entry.hint}
            currentUrl={initialLogos[entry.slot]}
            canEdit={canEdit}
          />
        ))}
      </div>
    </section>
  );
}

function LogoTile({
  slot,
  label,
  hint,
  currentUrl,
  canEdit,
}: {
  slot: LogoSlot;
  label: string;
  hint: string;
  currentUrl: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [removing, startRemove] = useTransition();

  function pick() {
    fileInputRef.current?.click();
  }

  function onPick(file: File) {
    const formData = new FormData();
    formData.append("slot", slot);
    formData.append("file", file);
    startUpload(async () => {
      const result = await uploadBrandLogo(formData);
      if (!result.ok) {
        toast.error("Upload failed", { description: result.error });
        return;
      }
      toast.success(`${label} updated`);
      router.refresh();
    });
  }

  function onRemove() {
    startRemove(async () => {
      const result = await removeBrandLogo(slot);
      if (!result.ok) {
        toast.error("Remove failed", { description: result.error });
        return;
      }
      toast.success(`${label} removed`);
      router.refresh();
    });
  }

  // Light vs dark preview backgrounds so a white logo isn't invisible
  // on the "On dark" tile and vice versa.
  const previewBg =
    slot === "dark"
      ? "bg-[#0a0a0a]"
      : slot === "light"
        ? "bg-white"
        : "bg-background";

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted">{hint}</span>
      </div>
      <div
        className={`relative aspect-square rounded-lg border border-border flex items-center justify-center overflow-hidden ${previewBg}`}
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt={`${label} preview`}
            className="max-h-[80%] max-w-[80%] object-contain"
          />
        ) : (
          <span
            className={`text-xs ${slot === "light" ? "text-black/40" : "text-muted"}`}
          >
            Empty
          </span>
        )}
      </div>
      {canEdit && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPick(file);
              e.target.value = "";
            }}
          />
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={pick}
              disabled={uploading || removing}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md text-muted hover:text-foreground hover:bg-surface-hover disabled:opacity-50 transition-colors"
            >
              {uploading ? "Uploading…" : currentUrl ? "Replace" : "Upload"}
            </button>
            {currentUrl && (
              <button
                type="button"
                onClick={onRemove}
                disabled={uploading || removing}
                className="px-2.5 py-1.5 text-xs font-medium rounded-md text-muted hover:text-error hover:bg-surface-hover disabled:opacity-50 transition-colors"
              >
                {removing ? "Removing…" : "Remove"}
              </button>
            )}
          </div>
        </>
      )}
      {!canEdit && !currentUrl && (
        <p className="text-xs text-muted text-center">Not set</p>
      )}
    </div>
  );
}

function ColorsSection({
  canEdit,
  colors,
  setColors,
}: {
  canEdit: boolean;
  colors: BrandColor[];
  setColors: (next: BrandColor[]) => void;
}) {
  function update(index: number, patch: Partial<BrandColor>) {
    setColors(colors.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }
  function remove(index: number) {
    setColors(colors.filter((_, i) => i !== index));
  }
  function add() {
    if (colors.length >= COLORS_MAX) {
      toast.error(`You can only have ${COLORS_MAX} colors`);
      return;
    }
    setColors([...colors, { name: "", hex: "#000000" }]);
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Color palette"
        description={`Up to ${COLORS_MAX} colors. Creators copy hex values straight from the brief detail page.`}
      />
      {colors.length === 0 && !canEdit && (
        <p className="text-sm text-muted">No colors set yet.</p>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        {colors.map((color, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
          >
            {canEdit ? (
              <input
                type="color"
                value={hexForPicker(color.hex)}
                onChange={(e) => update(index, { hex: e.target.value })}
                className="h-10 w-10 shrink-0 bg-background border border-border rounded cursor-pointer"
                aria-label="Color picker"
              />
            ) : (
              <span
                aria-hidden="true"
                className="h-10 w-10 shrink-0 rounded border border-border"
                style={{ backgroundColor: color.hex }}
              />
            )}
            <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
              <Input
                type="text"
                value={color.name}
                onChange={(e) => update(index, { name: e.target.value })}
                placeholder="e.g. Primary"
                disabled={!canEdit}
                maxLength={60}
              />
              <Input
                type="text"
                value={color.hex}
                onChange={(e) => update(index, { hex: e.target.value })}
                placeholder="#09D7D7"
                disabled={!canEdit}
                className="font-mono"
                maxLength={9}
              />
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="text-xs text-muted hover:text-error transition-colors"
                aria-label="Remove color"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={add}
          disabled={colors.length >= COLORS_MAX}
          className="text-sm font-medium text-accent hover:text-accent-hover disabled:opacity-50 transition-colors"
        >
          + Add color ({colors.length}/{COLORS_MAX})
        </button>
      )}
    </section>
  );
}

function TypographySection({
  canEdit,
  typography,
  setTypography,
}: {
  canEdit: boolean;
  typography: BrandTypography[];
  setTypography: (next: BrandTypography[]) => void;
}) {
  function update(index: number, patch: Partial<BrandTypography>) {
    setTypography(
      typography.map((t, i) => (i === index ? { ...t, ...patch } : t))
    );
  }
  function remove(index: number) {
    setTypography(typography.filter((_, i) => i !== index));
  }
  function add() {
    if (typography.length >= TYPOGRAPHY_MAX) {
      toast.error(`You can only have ${TYPOGRAPHY_MAX} typography rows`);
      return;
    }
    setTypography([
      ...typography,
      { role: "heading", family: "", url: null },
    ]);
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Typography"
        description={`Up to ${TYPOGRAPHY_MAX} entries. Optional URL for Google Fonts or a hosted file.`}
      />
      {typography.length === 0 && !canEdit && (
        <p className="text-sm text-muted">No typography set yet.</p>
      )}
      <div className="space-y-3">
        {typography.map((row, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-surface p-3 grid grid-cols-1 sm:grid-cols-[140px_1fr_1fr_auto] gap-2 items-center"
          >
            {canEdit ? (
              <select
                value={row.role}
                onChange={(e) =>
                  update(index, { role: e.target.value as BrandTypographyRole })
                }
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                aria-label="Typography role"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs uppercase tracking-wider text-muted">
                {row.role}
              </span>
            )}
            <Input
              type="text"
              value={row.family}
              onChange={(e) => update(index, { family: e.target.value })}
              placeholder="e.g. Plus Jakarta Sans"
              disabled={!canEdit}
              maxLength={80}
            />
            <Input
              type="url"
              value={row.url ?? ""}
              onChange={(e) => update(index, { url: e.target.value || null })}
              placeholder="https://fonts.google.com/…"
              disabled={!canEdit}
              className="font-mono text-xs"
            />
            {canEdit && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="text-xs text-muted hover:text-error transition-colors justify-self-end"
                aria-label="Remove typography row"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={add}
          disabled={typography.length >= TYPOGRAPHY_MAX}
          className="text-sm font-medium text-accent hover:text-accent-hover disabled:opacity-50 transition-colors"
        >
          + Add typography ({typography.length}/{TYPOGRAPHY_MAX})
        </button>
      )}
    </section>
  );
}

function GuidelinesSection({
  canEdit,
  initial,
}: {
  canEdit: boolean;
  initial: { url: string | null; isExternal: boolean };
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [externalUrl, setExternalUrl] = useState<string>(
    initial.isExternal ? (initial.url ?? "") : ""
  );
  const [uploading, startUpload] = useTransition();
  const [savingUrl, startSaveUrl] = useTransition();
  const [removing, startRemove] = useTransition();

  function pick() {
    fileInputRef.current?.click();
  }

  function onUpload(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    startUpload(async () => {
      const result = await uploadGuidelinesFile(formData);
      if (!result.ok) {
        toast.error("Upload failed", { description: result.error });
        return;
      }
      toast.success("Guidelines uploaded");
      router.refresh();
    });
  }

  function onSaveUrl() {
    startSaveUrl(async () => {
      const result = await setGuidelinesUrl(externalUrl);
      if (!result.ok) {
        toast.error("Couldn't save URL", { description: result.error });
        return;
      }
      toast.success("Guidelines link saved");
      router.refresh();
    });
  }

  function onRemove() {
    startRemove(async () => {
      const result = await removeGuidelines();
      if (!result.ok) {
        toast.error("Couldn't remove", { description: result.error });
        return;
      }
      setExternalUrl("");
      toast.success("Guidelines removed");
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Brand guidelines"
        description="Upload a PDF or link to an external doc (Notion, Figma, Drive, etc.)."
      />
      {initial.url ? (
        <div className="rounded-lg border border-border bg-surface p-4 flex items-center gap-3">
          <svg
            className="w-8 h-8 text-muted shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {initial.isExternal ? "External link" : "Uploaded PDF"}
            </p>
            <a
              href={initial.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-accent truncate block font-mono"
            >
              {initial.isExternal ? initial.url : "Open guidelines →"}
            </a>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={onRemove}
              disabled={removing}
              className="text-xs text-muted hover:text-error transition-colors disabled:opacity-50"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          )}
        </div>
      ) : !canEdit ? (
        <p className="text-sm text-muted">No guidelines set yet.</p>
      ) : null}

      {canEdit && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-dashed border-border p-4 space-y-2">
            <p className="text-sm font-semibold">Upload a PDF</p>
            <p className="text-xs text-muted">PDF, up to 10 MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={pick}
              disabled={uploading}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-background border border-border hover:bg-surface-hover disabled:opacity-50 transition-colors"
            >
              {uploading ? "Uploading…" : initial.url ? "Replace PDF" : "Choose file"}
            </button>
          </div>
          <div className="rounded-lg border border-dashed border-border p-4 space-y-2">
            <p className="text-sm font-semibold">Or use an external URL</p>
            <Input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://notion.so/…"
              className="font-mono text-xs"
            />
            <button
              type="button"
              onClick={onSaveUrl}
              disabled={savingUrl || !externalUrl.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-background border border-border hover:bg-surface-hover disabled:opacity-50 transition-colors"
            >
              {savingUrl ? "Saving…" : "Save URL"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function NotesSection({
  canEdit,
  notes,
  setNotes,
}: {
  canEdit: boolean;
  notes: string;
  setNotes: (next: string) => void;
}) {
  return (
    <section className="space-y-4">
      <SectionHeader
        title="Voice & tone notes"
        description={`Short copy that helps creators sound on-brand. Up to ${NOTES_MAX} characters.`}
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
        placeholder="e.g. Direct and warm. Avoid jargon. Use sentence case for headings."
        rows={5}
        disabled={!canEdit}
        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <p className="text-xs text-muted text-right">
        {notes.length}/{NOTES_MAX}
      </p>
    </section>
  );
}

function hexForPicker(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) return trimmed.slice(0, 7);
  return "#000000";
}
