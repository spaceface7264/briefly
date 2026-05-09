import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-pj-editorial",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function SandboxEditorialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${fraunces.variable} ${plusJakarta.variable}`}>
      {children}
    </div>
  );
}
