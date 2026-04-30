import { redirect } from "next/navigation";

// Notifications moved into /profile/settings as a tab. Old URL kept
// as a redirect so any links / bookmarks survive.
export default function NotificationsRedirect() {
  redirect("/profile/settings?tab=notifications");
}
