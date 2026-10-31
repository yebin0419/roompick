import { createClient } from "@/lib/supabase/server";
import ReportsAdmin from "./ReportsAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "신고 처리 · 관리자 · 룸픽" };

export default async function AdminReportsPage() {
  const supabase = createClient();
  const { data } = await supabase.from("reports")
    .select("id, category, content, status, photo_url, created_at, reporter:profiles(id, name, student_id), room:rooms(code)")
    .order("created_at", { ascending: false })
    .limit(100);
  return <ReportsAdmin items={(data ?? []) as any} />;
}
