import { createClient } from "@/lib/supabase/server";
import PreferencesClient from "./PreferencesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "마이페이지 · 룸픽" };

export default async function PreferencesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: reservations }, { data: reports }] = await Promise.all([
    supabase
      .from("profiles")
      .select("name, email, student_id, approval_status, student_card_url, role")
      .eq("id", user!.id).maybeSingle(),
    supabase
      .from("reservations")
      .select("id, start_time, end_time, status, purpose, is_event, room:rooms(code, building, floor)")
      .eq("user_id", user!.id)
      .order("start_time", { ascending: false })
      .limit(20),
    supabase
      .from("reports")
      .select("id, category, content, status, created_at, photo_url, room:rooms(code)")
      .eq("reporter_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <PreferencesClient
      profile={profile!}
      reservations={(reservations ?? []) as any}
      reports={(reports ?? []) as any}
    />
  );
}
