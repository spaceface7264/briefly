"use client";

import { Pencil, Trash2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Read-only / edit-mode primitives shared across settings surfaces
 * (creator profile, creator payouts, admin personal account).
 *
 * Pattern: a card sits in "view" mode showing its fields as
 * `SettingsReadRow`s; a small pen button in the header flips the card
 * into "edit" mode where the parent renders its inputs and a footer
 * with Save/Cancel appears. `AvatarPenTile` + `AvatarPenDialog` handle
 * the picture-with-pen-overlay-and-modal flow used in two places.
 */

interface SettingsCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  editing?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  savePending?: boolean;
  // True when a sibling card is being edited — we grey out this
  // card's pen so the user finishes one edit before starting
  // another. Keeps the per-section snapshot model honest.
  disableEdit?: boolean;
  // True when the form is clean (no diff vs. snapshot). Save stays
  // disabled until the user actually changes something — keeps
  // accidental no-op saves from hitting the server.
  disableSave?: boolean;
  // Label used in the pen button's aria-label; defaults to the card
  // title.
  editLabel?: string;
}

export function SettingsCard({
  title,
  description,
  children,
  editing,
  onEdit,
  onCancel,
  onSave,
  savePending,
  disableEdit,
  disableSave,
  editLabel,
}: SettingsCardProps) {
  const editable = Boolean(onEdit);
  return (
    <section className="bg-surface border border-border rounded-xl p-6 space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && (
            <p className="text-muted text-sm mt-0.5">{description}</p>
          )}
        </div>
        {editable && !editing && (
          <button
            type="button"
            onClick={onEdit}
            disabled={disableEdit}
            aria-label={`Edit ${editLabel ?? title}`}
            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-muted hover:text-foreground rounded-lg hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
      </header>
      <div className="space-y-5">{children}</div>
      {editable && editing && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            disabled={savePending}
            className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={savePending || disableSave}
            className="px-4 py-2 text-sm bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold rounded-lg transition-colors"
          >
            {savePending ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </section>
  );
}

interface SettingsReadRowProps {
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}

export function SettingsReadRow({ label, value, action }: SettingsReadRowProps) {
  const empty =
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "");
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium mb-1.5">{label}</div>
        <div className={empty ? "text-sm text-muted italic" : "text-sm"}>
          {empty ? "Not set" : value}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Round avatar tile with a pen overlay revealed on hover/focus.
 * Click opens an `AvatarPenDialog` for upload/remove choices —
 * keeps the read view uncluttered (no Replace/Remove/file-info
 * chrome inline).
 */
export function AvatarPenTile({
  avatarUrl,
  initial,
  onOpen,
  size = "lg",
}: {
  avatarUrl: string | null;
  initial: string;
  onOpen: () => void;
  size?: "md" | "lg";
}) {
  const dims = size === "lg" ? "h-20 w-20" : "h-16 w-16";
  const initialSize = size === "lg" ? "text-2xl" : "text-xl";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Edit profile picture"
      className={`group relative ${dims} shrink-0 overflow-hidden rounded-full border border-border bg-background outline-none focus-visible:ring-2 focus-visible:ring-accent`}
    >
      {avatarUrl ? (
        // Plain <img> by convention: keeps avatars/logos out of
        // next/image so we don't maintain a remotePatterns
        // allow-list for every Supabase project URL, and blob:
        // optimistic previews work without extra loader config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt="Profile picture"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center ${initialSize} font-semibold text-muted`}
        >
          {initial}
        </div>
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
        <Pencil className={size === "lg" ? "h-5 w-5 text-white" : "h-4 w-4 text-white"} />
      </span>
    </button>
  );
}

export function AvatarPenDialog({
  open,
  onOpenChange,
  hasAvatar,
  pending,
  onPick,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasAvatar: boolean;
  pending: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Profile picture</DialogTitle>
          <DialogDescription>
            PNG, JPEG, or WebP. Up to 2 MB.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onPick}
            disabled={pending}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
          >
            <Upload className="h-4 w-4 text-muted" />
            {hasAvatar ? "Replace picture" : "Upload picture"}
          </button>
          {hasAvatar && (
            <button
              type="button"
              onClick={onClear}
              disabled={pending}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg border border-border text-error hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
            >
              <Trash2 className="h-4 w-4" />
              Remove picture
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Small pen icon button used in `SettingsReadRow` actions to start
 * inline row-level editing. Distinct from the card-level pen because
 * it sits at the right side of an individual row.
 */
export function RowPenButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Edit ${label}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-muted hover:text-foreground rounded-lg hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <Pencil className="h-3.5 w-3.5" />
      Edit
    </button>
  );
}
