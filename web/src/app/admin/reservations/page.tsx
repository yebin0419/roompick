import { createClient } from "@/lib/supabase/server";
import ReservationsAdmin from "./ReservationsAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "예약 관리 · 관리자 · 룸픽" };

export default async function AdminReservationsPage() {
  const supabase = createClient();
  const { data } = await supabase.from("reservations")
    .select("id, start_time, end_time, status, purpose, is_event, created_at, user:profiles(id, name, student_id), room:rooms(id, code)")
    .order("start_time", { ascending: false })
    .limit(100);
  return <ReservationsAdmin items={(data ?? []) as any} />;
}
