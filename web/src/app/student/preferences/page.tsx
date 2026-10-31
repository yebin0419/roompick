import { createClient } from "@/lib/supabase/server";
import PreferencesClient from "./PreferencesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "마이페이지 · 룸픽" };

export default async function PreferencesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, student_id, approval_status, student_card_url, role")
    .eq("id", user!.id).maybeSingle();
  return <PreferencesClient profile={profile!} />;
}
