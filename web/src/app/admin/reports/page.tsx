import { createClient } from "@/lib/supabase/server";
import ReportsAdmin from "./ReportsAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "신고 처리 · 관리자 · 룸픽" };

export default async function AdminReportsPage() {
  const supabase = createClient();
  const { data, error } = await supabase.from("reports")
    .select(`
      id, category, content, status, photo_url, created_at,
      reporter:profiles!reports_reporter_id_fkey(id, name, student_id, department),
      room:rooms(code, building, floor)
    `)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) console.error("admin reports query failed:", error);
  return <ReportsAdmin items={(data ?? []) as any} />;
}
