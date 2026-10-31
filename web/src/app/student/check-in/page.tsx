import { createClient } from "@/lib/supabase/server";
import CheckInClient from "./CheckInClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "체크인 · 룸픽" };

export default async function CheckInPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date().toISOString();
  const { data } = await supabase
    .from("reservations")
    .select("id, start_time, end_time, status, room:rooms(id, code, building, floor)")
    .eq("user_id", user!.id)
    .in("status", ["RESERVED", "CHECKED_IN"])
    .lte("start_time", now)
    .gte("end_time", now)
    .order("start_time");

  return <CheckInClient reservations={(data ?? []) as any} />;
}
