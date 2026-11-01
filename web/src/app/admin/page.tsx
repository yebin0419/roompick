import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = createClient();
  const now = new Date().toISOString();

  const [pendingVerify, openReports, upcomingRes, totalRooms] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("approval_status", "PENDING"),
    supabase.from("reports").select("id", { count: "exact", head: true }).in("status", ["OPEN", "IN_PROGRESS"]),
    supabase.from("reservations")
      .select("id", { count: "exact", head: true })
      .in("status", ["RESERVED", "CHECKED_IN"])
      .gt("end_time", now),
    supabase.from("rooms").select("id", { count: "exact", head: true }),
  ]);

  const { data: recent } = await supabase
    .from("reservations")
    .select("id, start_time, end_time, status, purpose, is_event, user:profiles(name, student_id), room:rooms(code)")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>
        <p className="mt-1 text-sm text-slate-500">
          실시간 운영 모니터링과 처리 대기 건들을 한눈에 봅니다.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="학생증 승인 대기" value={pendingVerify.count ?? 0} href="/admin/verifications" />
        <Stat title="미처리 신고" value={openReports.count ?? 0} href="/admin/reports" />
        <Stat title="활성/예정 예약" value={upcomingRes.count ?? 0} href="/admin/reservations" />
        <Stat title="등록 강의실" value={totalRooms.count ?? 0} href="/admin/analytics" />
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-3">최근 예약</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-2 pr-3 font-medium">학생</th>
              <th className="py-2 pr-3 font-medium">강의실</th>
              <th className="py-2 pr-3 font-medium">시간</th>
              <th className="py-2 pr-3 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {(recent ?? []).map((r: any) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="py-2 pr-3">
                  <div>{r.user?.name ?? "-"}</div>
                  <div className="text-xs text-slate-400">{r.user?.student_id}</div>
                </td>
                <td className="py-2 pr-3">{r.room?.code}</td>
                <td className="py-2 pr-3 text-slate-600">
                  {new Date(r.start_time).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="py-2 pr-3">
                  <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5">
                    {r.status}{r.is_event ? " · 행사" : ""}
                  </span>
                </td>
              </tr>
            ))}
            {(recent ?? []).length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-slate-500">최근 예약이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ title, value, href }: { title: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-2xl bg-white border border-slate-200 p-5 hover:border-slate-300 transition">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{value}</p>
    </Link>
  );
}
