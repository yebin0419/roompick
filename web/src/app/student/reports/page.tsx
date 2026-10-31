import { createClient } from "@/lib/supabase/server";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "신고 · 룸픽" };

export default async function ReportsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: rooms }, { data: my }] = await Promise.all([
    supabase.from("rooms").select("id, code").order("code"),
    supabase.from("reports")
      .select("id, category, content, status, created_at, room:rooms(code)")
      .eq("reporter_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  return <ReportsClient rooms={rooms ?? []} myReports={(my ?? []) as any} />;
}
