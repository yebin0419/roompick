import { createClient } from "@/lib/supabase/server";
import VerificationsClient from "./VerificationsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "학생증 승인 · 관리자 · 룸픽" };

export default async function VerificationsPage() {
  const supabase = createClient();
  const { data } = await supabase.from("profiles")
    .select("id, name, student_id, department, email, approval_status, student_card_url, rejection_reason, created_at")
    .eq("role", "STUDENT")
    .in("approval_status", ["PENDING", "REJECTED"])
    .order("created_at", { ascending: false });
  return <VerificationsClient items={data ?? []} />;
}
