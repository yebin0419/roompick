import { createClient } from "@/lib/supabase/server";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "운영 리포트 · 관리자 · 룸픽" };

export default async function AnalyticsPage() {
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [{ data: res }, { data: rooms }, { data: reports }, { data: policies }] = await Promise.all([
    supabase.from("reservations")
      .select("room_id, status, start_time, end_time, is_event")
      .gte("start_time", since.toISOString()),
    supabase.from("rooms").select("id, code, building, floor, capacity, room_type"),
    supabase.from("reports").select("room_id, category, status, created_at")
      .gte("created_at", since.toISOString()),
    supabase.from("system_policies").select("key, value, description"),
  ]);

  return (
    <AnalyticsClient
      reservations={res ?? []}
      rooms={rooms ?? []}
      reports={reports ?? []}
      policies={policies ?? []}
    />
  );
}
