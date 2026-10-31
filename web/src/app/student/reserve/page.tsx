import { createClient } from "@/lib/supabase/server";
import ReserveClient from "./ReserveClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "예약 · 룸픽" };

export default async function ReservePage() {
  const supabase = createClient();
  const [{ data: rooms }, { data: courses }] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, code, building, floor, room_type, capacity")
      .order("code"),
    supabase.from("courses").select("room_code, weekday, start_period, end_period"),
  ]);

  return <ReserveClient rooms={rooms ?? []} courses={(courses ?? []) as any} />;
}
