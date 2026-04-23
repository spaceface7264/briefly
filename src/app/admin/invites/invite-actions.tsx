"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/modal";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I, O, 0, 1 to avoid confusion
  let code = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function InviteActions() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [count, setCount] = useState(5);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(30);
  const [generating, setGenerating] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  function closeAndReset() {
    setShowModal(false);
    // Reset after the modal has animated out
    setTimeout(() => {
      setGeneratedCodes([]);
      setError("");
      setCopied(false);
    }, 200);
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in");
      setGenerating(false);
      return;
    }

    const codes: string[] = [];
    const now = new Date();
    const expiresAt = expiresInDays
      ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    for (let i = 0; i < count; i++) {
      codes.push(generateCode());
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from("invite_codes")
      .insert(
        codes.map((code: string) => ({
          code,
          created_by: user.id,
          expires_at: expiresAt,
        }))
      );

    if (insertError) {
      console.error("Insert error:", insertError);
      setError("Failed to generate codes");
      setGenerating(false);
      return;
    }

    setGeneratedCodes(codes);
    setGenerating(false);
    router.refresh();
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(generatedCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const showResult = generatedCodes.length > 0;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors"
      >
        Generate Codes
      </button>

      <Modal
        open={showModal}
        onClose={closeAndReset}
        title={showResult ? "Codes generated" : "Generate invite codes"}
        description={
          showResult
            ? `${generatedCodes.length} code${generatedCodes.length !== 1 ? "s" : ""} ready to share`
            : "Codes are single-use. Each one lets a new creator sign up."
        }
        size="sm"
        footer={
          showResult ? (
            <>
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 border border-border-strong hover:bg-surface-hover text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy all
                  </>
                )}
              </button>
              <button
                onClick={closeAndReset}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-lg transition-colors"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                onClick={closeAndReset}
                disabled={generating}
                className="px-4 py-2 border border-border-strong hover:bg-surface-hover disabled:opacity-50 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background text-sm font-semibold rounded-lg transition-colors"
              >
                {generating ? "Generating..." : `Generate ${count}`}
              </button>
            </>
          )
        }
      >
        {showResult ? (
          <div className="bg-surface border border-border rounded-lg p-4 max-h-72 overflow-auto">
            <ul className="space-y-1.5 font-mono text-sm">
              {generatedCodes.map((code) => (
                <li
                  key={code}
                  className="flex items-center justify-between gap-3 px-2 py-1 rounded hover:bg-surface-hover group"
                >
                  <span className="text-accent tracking-wider">{code}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(code)}
                    className="text-xs text-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Copy
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="count" className="block text-sm font-medium mb-2">
                Number of codes
              </label>
              <input
                id="count"
                type="number"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                min={1}
                max={50}
                className="w-full px-4 py-3 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors font-mono"
              />
            </div>

            <div>
              <label htmlFor="expires" className="block text-sm font-medium mb-2">
                Expires in
              </label>
              <select
                id="expires"
                value={expiresInDays ?? "never"}
                onChange={(e) =>
                  setExpiresInDays(e.target.value === "never" ? null : parseInt(e.target.value))
                }
                className="w-full px-4 py-3 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value="never">Never</option>
              </select>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-error-muted border border-error/30 rounded-lg p-3">
                <svg className="w-4 h-4 text-error shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
                </svg>
                <p className="text-error text-sm">{error}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
