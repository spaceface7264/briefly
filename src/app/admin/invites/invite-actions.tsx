"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors"
      >
        Generate Codes
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => {
              setShowModal(false);
              setGeneratedCodes([]);
            }}
          />
          <div className="relative bg-surface border border-border rounded-xl p-6 max-w-md w-full">
            {generatedCodes.length === 0 ? (
              <>
                <h2 className="text-xl font-bold mb-4">Generate Invite Codes</h2>

                <div className="space-y-4 mb-6">
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
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label htmlFor="expires" className="block text-sm font-medium mb-2">
                      Expires in (days)
                    </label>
                    <select
                      id="expires"
                      value={expiresInDays ?? "never"}
                      onChange={(e) =>
                        setExpiresInDays(e.target.value === "never" ? null : parseInt(e.target.value))
                      }
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent"
                    >
                      <option value={7}>7 days</option>
                      <option value={30}>30 days</option>
                      <option value={90}>90 days</option>
                      <option value="never">Never</option>
                    </select>
                  </div>
                </div>

                {error && <p className="text-error text-sm mb-4">{error}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2.5 border border-border hover:bg-surface-hover font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex-1 px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background font-semibold rounded-lg transition-colors"
                  >
                    {generating ? "Generating..." : "Generate"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-4">Codes Generated</h2>

                <div className="bg-background border border-border rounded-lg p-4 mb-4 max-h-64 overflow-auto">
                  <div className="space-y-2 font-mono text-sm">
                    {generatedCodes.map((code) => (
                      <div key={code} className="text-accent">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={copyToClipboard}
                    className="flex-1 px-4 py-2.5 border border-border hover:bg-surface-hover font-medium rounded-lg transition-colors"
                  >
                    Copy All
                  </button>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setGeneratedCodes([]);
                    }}
                    className="flex-1 px-4 py-2.5 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
