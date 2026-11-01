import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LiveClock from "@/components/LiveClock";
import PickSection from "./PickSection";

export const dynamic = "force-dynamic";

export default async function StudentHome() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 필터링은 클라이언트에서 수행하므로, 조회 범위는 넉넉히 (오늘 ~ 14일 뒤)
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);

  const [{ data: rooms }, { data: courses }, { data: allRes }, { data: myReservations }] =
    await Promise.all([
      supabase.from("rooms")
        .select("id, code, building, floor, room_type, capacity")
        .order("code"),
      supabase.from("courses").select("room_code, weekday, start_period, end_period"),
      supabase.from("reservations")
        .select("room_id, start_time, end_time")
        .in("status", ["RESERVED", "CHECKED_IN"])
        .gte("start_time", start.toISOString())
        .lte("start_time", end.toISOString()),
      supabase.from("reservations")
        .select("id, start_time, end_time, status, room:rooms(code, building, floor)")
        .eq("user_id", user!.id)
        .gte("end_time", new Date().toISOString())
        .order("start_time")
        .limit(5),
    ]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white p-6 shadow-sm">
        <p className="text-xs opacity-90">룸픽 · 지금</p>
        <h1 className="mt-1 text-2xl font-bold">
          언제 어디서 공부할지, 바로 Pick
        </h1>
        <p className="mt-1 text-sm opacity-90">
          <LiveClock />
        </p>
        <Link
          href="/student/reserve"
          className="mt-5 inline-flex rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur px-4 py-2 text-sm font-medium"
        >
          전체 예약 페이지 →
        </Link>
      </section>

      <PickSection
        rooms={rooms ?? []}
        courses={(courses ?? []) as any}
        reservations={(allRes ?? []) as any}
      />

      <section>
        <h2 className="text-lg font-semibold text-slate-900">내 예약</h2>
        <ul className="mt-3 space-y-2">
          {(myReservations ?? []).map((r: any) => (
            <li key={r.id} className="rounded-xl bg-white border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{r.room?.code}</p>
                <p className="text-xs text-slate-500">
                  {new Date(r.start_time).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" ~ "}
                  {new Date(r.end_time).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <StatusChip status={r.status} />
            </li>
          ))}
          {(myReservations ?? []).length === 0 && (
            <p className="text-sm text-slate-500">예정된 예약이 없어요.</p>
          )}
        </ul>
      </section>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    RESERVED: "bg-blue-50 text-blue-700",
    CHECKED_IN: "bg-emerald-50 text-emerald-700",
    CANCELLED: "bg-slate-100 text-slate-500",
    COMPLETED: "bg-slate-100 text-slate-500",
    NO_SHOW: "bg-red-50 text-red-700",
  };
  const label: Record<string, string> = {
    RESERVED: "예약됨", CHECKED_IN: "입실", CANCELLED: "취소", COMPLETED: "완료", NO_SHOW: "노쇼",
  };
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 ${map[status] ?? "bg-slate-100"}`}>
      {label[status] ?? status}
    </span>
  );
}
