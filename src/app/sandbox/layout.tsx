import {
  Inter_Tight,
  Instrument_Serif,
  Geist_Mono,
  IBM_Plex_Mono,
  DM_Mono,
  Space_Mono,
  Lexend,
  Figtree,
} from "next/font/google";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

/* Mono candidates for /sandbox comparison row.
   JetBrains Mono is the current pick — already loaded in root. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function SandboxLayout({ children }: { children: React.ReactNode }) {
  const variables = [
    interTight.variable,
    instrumentSerif.variable,
    geistMono.variable,
    ibmPlexMono.variable,
    dmMono.variable,
    spaceMono.variable,
    lexend.variable,
    figtree.variable,
  ].join(" ");
  return (
    <>
      {/* Clear Sans isn't on Google Fonts; load from fontsource CDN.
          Scoped to /sandbox by being in the sandbox layout. */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@fontsource/clear-sans@5/400.css"
      />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@fontsource/clear-sans@5/500.css"
      />
      <div className={variables}>{children}</div>
    </>
  );
}
