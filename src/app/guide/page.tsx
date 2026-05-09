import { Nav } from "@/components/nav";
import Link from "next/link";

export default function GuidePage() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="font-display tracking-tight text-3xl font-bold mb-2">Content Guide</h1>
            <p className="text-text-secondary">
              Tips and guidelines for creating great content
            </p>
            <p className="text-sm text-muted mt-2">
              Looking for claim, review, and payout process?{" "}
              <Link href="/how-it-works" className="text-brand-ink hover:underline">
                See How it works
              </Link>
              .
            </p>
          </div>

          <div className="space-y-8">
            {/* Section 1: Why Great Content Matters */}
            <section className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 bg-brand-muted rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-brand-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </span>
                <div>
                  <h2 className="font-display tracking-tight text-xl font-bold">Why great content matters</h2>
                  <p className="text-text-secondary text-sm">Stand out with authentic, engaging work</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-brand-ink mb-2">What makes content perform:</p>
                  <ul className="text-sm text-text-secondary space-y-1">
                    <li>• Authenticity — real people in real settings beat polished stock</li>
                    <li>• Strong hook in the first 2-3 seconds</li>
                    <li>• Clear message — one idea per piece</li>
                    <li>• Show, don&apos;t tell — let the experience speak</li>
                    <li>• Good lighting and stable footage go a long way</li>
                    <li>• Captions on every video — most viewers watch on mute</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 2: Content Types */}
            <section className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 bg-brand-muted rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-brand-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </span>
                <div>
                  <h2 className="font-display tracking-tight text-xl font-bold">Content types</h2>
                  <p className="text-text-secondary text-sm">What you&apos;ll typically create</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Short-form video</p>
                  <p className="text-sm text-text-secondary">
                    Reels, TikToks, Shorts. 15-45 seconds, vertical (9:16), captions required.
                  </p>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Medium-form video</p>
                  <p className="text-sm text-text-secondary">
                    45-90 seconds. Still vertical, with captions. Good for tutorials or walkthroughs.
                  </p>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Long-form video</p>
                  <p className="text-sm text-text-secondary">
                    2-10 minutes, landscape (16:9), 1080p minimum. Deeper storytelling or guides.
                  </p>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Static / photography</p>
                  <p className="text-sm text-text-secondary">
                    High-res photos (2000px+ wide), JPG or PNG. Product shots, lifestyle, event coverage.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3: Working with Briefs */}
            <section className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 bg-brand-muted rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-brand-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </span>
                <div>
                  <h2 className="font-display tracking-tight text-xl font-bold">Working with briefs</h2>
                  <p className="text-text-secondary text-sm">How to deliver great work every time</p>
                </div>
              </div>

              <div>
                <ul className="text-sm text-text-secondary space-y-1">
                  <li>• Read the full brief before claiming — make sure it fits your style</li>
                  <li>• Check the deliverable specs (format, length, resolution)</li>
                  <li>• Deliver within the 7-day claim window</li>
                  <li>• Include a direct link to the content in your submission</li>
                  <li>• Add notes if there&apos;s anything the reviewer should know</li>
                  <li>• If a brief is marked as an ad, follow the paid content guidelines below</li>
                </ul>
              </div>
            </section>

            {/* Section 4: Paid Content Tips */}
            <section className="bg-warning/10 border border-warning/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 bg-warning/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-warning-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
                <div>
                  <h2 className="font-display tracking-tight text-xl font-bold text-warning-ink">Important for paid content</h2>
                  <p className="text-text-secondary text-sm">Applies to all ad-intended briefs</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Hook (first 2-3 sec)</p>
                  <p className="text-sm text-text-secondary">
                    Grab attention immediately. Start with a question, a bold statement, or a visual surprise.
                  </p>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Length</p>
                  <p className="text-sm text-text-secondary">
                    <span className="text-brand-ink font-mono">8-15 sec</span> is ideal for ads.
                    <br />Max 30 seconds.
                  </p>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Captions</p>
                  <p className="text-sm text-text-secondary">
                    All videos need captions centered in the frame so they work across all placements.
                  </p>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Branding</p>
                  <p className="text-sm text-text-secondary">
                    Make the brand visible: mention the name, show the logo, or film in a branded setting.
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-background/50 rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">Pro tip:</span>{" "}
                  <span className="text-text-secondary">
                    The same footage can be cut multiple ways for more content.
                    Platforms perform better the more variations you have.
                  </span>
                </p>
              </div>
            </section>

          </div>
        </div>
      </main>
    </>
  );
}
