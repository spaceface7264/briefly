import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Geist } from "next/font/google";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { ScrollToTopOnRouteChange } from "@/components/scroll-to-top-on-route-change";
import { OrgProvider } from "@/lib/org-context";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
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
      className={cn("dark", "h-full", "antialiased", plusJakarta.variable, jetbrainsMono.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <Suspense fallback={null}>
          <ScrollToTopOnRouteChange />
        </Suspense>
        <OrgProvider orgId={orgId}>
          {children}
        </OrgProvider>
        <Footer />
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
