import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Geist } from "next/font/google";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { ScrollToTopOnRouteChange } from "@/components/scroll-to-top-on-route-change";
import { LocaleProvider } from "@/lib/i18n/provider";
import { getLocale } from "@/lib/i18n/server";
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

export const metadata: Metadata = {
  title: "Boulders Creators",
  description: "Content creator platform for Boulders",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn("dark", "h-full", "antialiased", plusJakarta.variable, jetbrainsMono.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <LocaleProvider locale={locale}>
          <Suspense fallback={null}>
            <ScrollToTopOnRouteChange />
          </Suspense>
          {children}
          <Footer />
        </LocaleProvider>
      </body>
    </html>
  );
}
