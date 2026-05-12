"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AvatarPenDialog,
  AvatarPenTile,
  RowPenButton,
  SettingsReadRow,
} from "@/components/settings-fields";
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_BYTES,
} from "@/lib/creator-profile";
import {
  removeOrgUserAvatar,
  uploadOrgUserAvatar,
} from "./personal-actions";

interface Props {
  initialName: string;
  email: string;
  /** Public URL into the `avatars` bucket. Null for users who haven't uploaded one yet. */
  initialAvatarUrl: string | null;
  /** Per-org role label shown in the read-only chip ("Admin" / "Member"). */
  roleLabel: string;
  /** Org name shown next to the role chip for context. */
  orgName: string;
}

const PASSWORD_MIN_LEN = 6;

export function PersonalAccountForm({
  initialName,
  email,
  initialAvatarUrl,
  roleLabel,
  orgName,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameSnapshot, setNameSnapshot] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [avatarPending, startAvatar] = useTransition();
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pwOpen, setPwOpen] = useState(false);

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

    // Optimistic preview while the upload + revalidate are in flight.
    setAvatarUrl(URL.createObjectURL(file));

    startAvatar(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadOrgUserAvatar(fd);
      if (!result.ok) {
        toast.error("Avatar upload failed", { description: result.error });
        // Roll back the optimistic preview.
        setAvatarUrl(initialAvatarUrl);
        return;
      }
      toast.success("Avatar updated");
      setAvatarDialogOpen(false);
      router.refresh();
    });
  }

  function clearAvatar() {
    startAvatar(async () => {
      const result = await removeOrgUserAvatar();
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

  function startEditName() {
    setNameSnapshot(name);
    setEditingName(true);
  }

  function cancelEditName() {
    if (nameSnapshot !== null) setName(nameSnapshot);
    setNameSnapshot(null);
    setEditingName(false);
  }

  const initialLetter =
    (name || email || "?").trim().charAt(0).toUpperCase() || "?";

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name can't be empty");
      return;
    }
    if (trimmed === initialName.trim()) return;

    setSavingName(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Not signed in");
      setSavingName(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("profiles") as any)
      .update({ name: trimmed })
      .eq("id", user.id);

    setSavingName(false);

    if (error) {
      toast.error("Couldn't save name", { description: error.message });
      return;
    }

    toast.success("Name saved");
    setEditingName(false);
    setNameSnapshot(null);
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1">Personal account</h2>
        <p className="text-muted text-sm">
          Your individual profile. Org settings live in the section below.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
        <div>
          <span className="block text-sm font-medium mb-2">
            Profile picture
          </span>
          <AvatarPenTile
            avatarUrl={avatarUrl}
            initial={initialLetter}
            size="md"
            onOpen={() => setAvatarDialogOpen(true)}
          />
        </div>
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

        {/* Inline-edit row for the name — the only editable text
            field on this card. The pen sits on the right of the row;
            click flips the value into an input with Save/Cancel. */}
        {editingName ? (
          <form onSubmit={handleSaveName} className="space-y-3">
            <div>
              <label
                htmlFor="personal-name"
                className="block text-sm font-medium mb-2"
              >
                Display name
              </label>
              <input
                id="personal-name"
                type="text"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                placeholder="Your name"
                autoComplete="name"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancelEditName}
                disabled={savingName}
                className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingName || name.trim() === initialName.trim()}
                className="px-4 py-2 text-sm bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold rounded-lg transition-colors"
              >
                {savingName ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        ) : (
          <SettingsReadRow
            label="Display name"
            value={name || null}
            action={
              <RowPenButton onClick={startEditName} label="display name" />
            }
          />
        )}

        <div className="border-t border-border pt-5 space-y-5">
          <SettingsReadRow label="Email" value={email} />
          <SettingsReadRow
            label="Role"
            value={
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-raised border border-border text-sm">
                <span className="font-medium">{roleLabel}</span>
                <span className="text-muted">at {orgName}</span>
              </span>
            }
          />
          <SettingsReadRow
            label="Password"
            value="••••••••"
            action={
              <button
                type="button"
                onClick={() => setPwOpen(true)}
                className="px-3 py-1.5 text-sm font-medium border border-border-strong hover:bg-surface-hover rounded-lg transition-colors"
              >
                Change password
              </button>
            }
          />
        </div>
      </div>

      <ChangePasswordDialog
        open={pwOpen}
        onOpenChange={setPwOpen}
        supabase={supabase}
      />
    </section>
  );
}

function ChangePasswordDialog({
  open,
  onOpenChange,
  supabase,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supabase: ReturnType<typeof createClient>;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setNewPassword("");
    setConfirmPassword("");
    setSaving(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword.length < PASSWORD_MIN_LEN) {
      toast.error(`Password must be at least ${PASSWORD_MIN_LEN} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);

    if (error) {
      toast.error("Couldn't update password", { description: error.message });
      return;
    }

    toast.success("Password updated");
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Block closing while the request is in flight so the success
        // toast lines up with a clean reset on the next open.
        if (saving) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Choose a new sign-in password. You&apos;ll stay signed in on this
            device.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium mb-2"
            >
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(ev) => setNewPassword(ev.target.value)}
              minLength={PASSWORD_MIN_LEN}
              autoComplete="new-password"
              placeholder={`Min ${PASSWORD_MIN_LEN} characters`}
              className="w-full px-4 py-3 bg-background border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium mb-2"
            >
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(ev) => setConfirmPassword(ev.target.value)}
              minLength={PASSWORD_MIN_LEN}
              autoComplete="new-password"
              placeholder="Repeat new password"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            />
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              disabled={saving}
              className="px-4 py-2 border border-border-strong hover:bg-surface-hover disabled:opacity-50 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !newPassword || !confirmPassword}
              className="px-4 py-2 bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold rounded-lg transition-colors text-sm"
            >
              {saving ? "Updating…" : "Update password"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
