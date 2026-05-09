import type { Metadata } from "next";
import {
  Plus_Jakarta_Sans,
  Inter_Tight,
  Instrument_Serif,
} from "next/font/google";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { FooterGate } from "@/components/footer-gate";
import { ScrollToTopOnRouteChange } from "@/components/scroll-to-top-on-route-change";
import { OrgProvider } from "@/lib/org-context";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import { cn } from "@/lib/utils";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

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

const platformName = process.env.NEXT_PUBLIC_PLATFORM_NAME || "Briefly";

export const metadata: Metadata = {
  title: platformName,
  description: `Content creator platform for ${platformName}`,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let orgId: string | null = null;
  try {
    const supabase = await createClient();
    orgId = await getActiveOrg(supabase);
  } catch {
    // Not authenticated — orgId stays null
  }

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        plusJakarta.variable,
        interTight.variable,
        instrumentSerif.variable,
        "font-sans",
      )}
    >
      <head>
        {/* Clear Sans — label/mono font; fontsource CDN since it's
            not on Google Fonts. Loaded only the weights we use. */}
        <link
          rel="preconnect"
          href="https://cdn.jsdelivr.net"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@fontsource/clear-sans@5/400.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@fontsource/clear-sans@5/500.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <ThemeProvider>
          <Suspense fallback={null}>
            <ScrollToTopOnRouteChange />
          </Suspense>
          <OrgProvider orgId={orgId}>
            {children}
          </OrgProvider>
          <FooterGate>
            <Footer />
          </FooterGate>
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
