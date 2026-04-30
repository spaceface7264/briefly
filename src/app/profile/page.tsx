import { redirect } from "next/navigation";

// Profile is now a tab inside /profile/settings. Keeping the old URL
// as a redirect so any bookmarks / external links / nav references
// continue to land on the right surface.
export default function ProfileRedirect() {
  redirect("/profile/settings");
}
