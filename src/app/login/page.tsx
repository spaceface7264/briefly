import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = await createClient();

  // Anonymous-readable per the "Anyone can read discoverable orgs"
  // policy added in 0022. When at least one org has discoverable=true
  // the signup form treats the invite code as optional — applicants
  // sign up freely and apply via /discover.
  const { count } = await supabase
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .eq("discoverable", true);

  const allowOpenSignup = (count ?? 0) > 0;

  return <LoginForm allowOpenSignup={allowOpenSignup} />;
}
