// Shared types + caps for the Brand Kit surface. Lives here (not in
// actions.ts) because Next.js requires every export from a "use
// server" file to be a function: types and constants need their own
// module.

export const COLORS_MAX = 12;
export const TYPOGRAPHY_MAX = 6;
export const NOTES_MAX = 1000;

export type BrandColor = { name: string; hex: string };

export type BrandTypographyRole = "heading" | "body" | "mono" | "accent";

export type BrandTypography = {
  role: BrandTypographyRole;
  family: string;
  url: string | null;
};

export type SaveBrandKitInput = {
  colors: BrandColor[];
  typography: BrandTypography[];
  notes: string;
};

export type LogoSlot = "mark" | "dark" | "light";

export const LOGO_SLOT_VALUES: ReadonlyArray<LogoSlot> = ["mark", "dark", "light"];
