"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  initialName: string;
  email: string;
  /** Per-org role label shown in the read-only chip ("Admin" / "Member"). */
  roleLabel: string;
  /** Org name shown next to the role chip for context. */
  orgName: string;
}

export function PersonalAccountForm({
  initialName,
  email,
  roleLabel,
  orgName,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameSaved(false);
    setNameError("");

    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Name can't be empty");
      return;
    }

    setSavingName(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setNameError("Not signed in");
      setSavingName(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("profiles") as any)
      .update({ name: trimmed })
      .eq("id", user.id);

    setSavingName(false);

    if (error) {
      setNameError(`Couldn't save: ${error.message}`);
      return;
    }

    setNameSaved(true);
    router.refresh();
    setTimeout(() => setNameSaved(false), 3000);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSaved(false);
    setPasswordError("");

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      setPasswordError(`Couldn't update password: ${error.message}`);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 4000);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1">Personal account</h2>
        <p className="text-muted text-sm">
          Your individual profile. Org settings live in the section below.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 space-y-8">
        <form onSubmit={handleSaveName} className="space-y-4">
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
            />
          </div>

          <div>
            <label
              htmlFor="personal-email"
              className="block text-sm font-medium mb-2"
            >
              Email
            </label>
            <input
              id="personal-email"
              type="email"
              value={email}
              disabled
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-muted cursor-not-allowed"
            />
            <p className="text-muted text-xs mt-1">
              Sign-in email. Contact support to change it.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Role</label>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-raised border border-border text-sm">
              <span className="font-medium">{roleLabel}</span>
              <span className="text-muted">at {orgName}</span>
            </div>
          </div>

          {nameError && <p className="text-error text-sm">{nameError}</p>}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={savingName || name.trim() === initialName.trim()}
              className="px-4 py-2 bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold rounded-lg transition-colors text-sm"
            >
              {savingName ? "Saving…" : "Save name"}
            </button>
            {nameSaved && (
              <span className="text-success text-sm">Saved</span>
            )}
          </div>
        </form>

        <div className="border-t border-border pt-6">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Change password</h3>
              <p className="text-muted text-xs">
                Choose a new sign-in password. You&apos;ll stay signed in on
                this device.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Min 6 characters"
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
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
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Repeat new password"
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>
            </div>

            {passwordError && (
              <p className="text-error text-sm">{passwordError}</p>
            )}

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={
                  savingPassword || !newPassword || !confirmPassword
                }
                className="px-4 py-2 bg-surface-raised hover:bg-surface-raised/80 disabled:opacity-50 disabled:cursor-not-allowed border border-border text-foreground font-medium rounded-lg transition-colors text-sm"
              >
                {savingPassword ? "Updating…" : "Update password"}
              </button>
              {passwordSaved && (
                <span className="text-success text-sm">Password updated</span>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
