import { Nav } from "@/components/nav";

export default function GuidePage() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Content Guide</h1>
            <p className="text-muted">
              Tips og retningslinjer for at skabe det bedste content
            </p>
          </div>

          <div className="space-y-8">
            {/* Section 1: Why Bouldering is Great */}
            <section className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 bg-accent-muted rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-xl font-bold">Hvorfor bouldering er fedt</h2>
                  <p className="text-muted text-sm">Aktivering af nye folk</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-muted mb-2">Målgruppe:</p>
                <p className="text-sm">Folk der ikke har prøvet bouldering eller kun prøvet få gange</p>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-accent mb-2">Fordele ved bouldering:</p>
                  <ul className="text-sm text-muted space-y-1">
                    <li>• God motion og træning</li>
                    <li>• Godt fællesskab</li>
                    <li>• Sjov og anderledes sport</li>
                    <li>• "Sådan kan en workout se ud"</li>
                    <li>• Tag din date med til bouldering</li>
                    <li>• Ved du ikke hvad du skal lave i weekenden?</li>
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-medium text-accent mb-2">Nedbryd indgangsbarrierer:</p>
                  <ul className="text-sm text-muted space-y-1">
                    <li>• Det er let, kræver ingen erfaring</li>
                    <li>• Der er mange begyndere</li>
                    <li>• Sjovt at prøve med venner eller alene</li>
                    <li>• For alle aldre</li>
                    <li>• Bouldering er også for kvinder</li>
                    <li>• For hele familien</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 2: Why Boulders */}
            <section className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 bg-accent-muted rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-xl font-bold">Hvorfor Boulders er bedst</h2>
                  <p className="text-muted text-sm">Nye kunder + skifte fra konkurrenter</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-muted mb-2">Målgruppe:</p>
                <p className="text-sm">Folk der overvejer bouldering + folk der boulder andre steder</p>
              </div>

              <div>
                <p className="text-sm font-medium text-accent mb-2">Hvorfor vælge Boulders:</p>
                <ul className="text-sm text-muted space-y-1">
                  <li>• Fitness sektionen inkluderet</li>
                  <li>• Gode instruktører der kan hjælpe</li>
                  <li>• Danmarks førende med flest haller</li>
                  <li>• Boulders i mange sværhedsgrader</li>
                  <li>• Regelmæssig udskiftning af boulders</li>
                  <li>• Events og fællesskab</li>
                  <li>• Gode til nybegyndere</li>
                  <li>• Hele familien er velkomne</li>
                </ul>
              </div>
            </section>

            {/* Section 3: Sales Activation */}
            <section className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 bg-accent-muted rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-xl font-bold">Bliv kunde hos Boulders</h2>
                  <p className="text-muted text-sm">Salgsaktivering</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-muted mb-2">Målgruppe:</p>
                <p className="text-sm">Folk der overvejer bouldering + folk uden fast sted + konkurrenters kunder</p>
              </div>

              <div>
                <p className="text-sm font-medium text-accent mb-2">Fokuspunkter:</p>
                <ul className="text-sm text-muted space-y-1">
                  <li>• Alt inkluderet i medlemskab</li>
                  <li>• Sjovere motionstype</li>
                  <li>• Fitness og bouldering i ét</li>
                  <li>• Adgang til alle haller</li>
                  <li>• 15 day pass til at prøve</li>
                  <li>• Punch cards til lejlighedsvis brug</li>
                </ul>
              </div>
            </section>

            {/* Section 4: Paid Content Tips */}
            <section className="bg-warning/10 border border-warning/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 bg-warning/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-xl font-bold text-warning">Vigtigt til paid content</h2>
                  <p className="text-muted text-sm">Gælder for alt ad-content</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Hook (første 2-3 sek)</p>
                  <p className="text-sm text-muted">
                    Fang seeren med det samme. Start gerne med et spørgsmål:
                    "Vidste du at bouldering er for alle?"
                  </p>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Længde</p>
                  <p className="text-sm text-muted">
                    <span className="text-accent font-mono">8-15 sek</span> er ideelt.
                    <br />Max 30 sekunder.
                  </p>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Undertekster</p>
                  <p className="text-sm text-muted">
                    Alle videoer skal have undertekster placeret i midten,
                    så de virker på tværs af placeringer.
                  </p>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Boulders branding</p>
                  <p className="text-sm text-muted">
                    Tydeliggør afsender: logo, nævn Boulders,
                    film steder med logo, brug Boulders t-shirt.
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-background/50 rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">Pro tip:</span>{" "}
                  <span className="text-muted">
                    Samme video kan klippes på flere måder for mere content.
                    Meta performer bedre jo mere content man har.
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
