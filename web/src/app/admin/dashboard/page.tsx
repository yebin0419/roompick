import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "ADMIN") redirect("/admin/students?error=forbidden");

  // 행정실 대기 중인 EVENT 건수 + 최근 리스트
  const [{ count: pendingAdminCount }, { data: pendingAdmin }] = await Promise.all([
    supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("status", "PENDING_ADMIN"),
    supabase
      .from("reservations")
      .select("id, room_code, reservation_date, start_period, end_period, attendees, purpose, student_id, created_at")
      .eq("status", "PENDING_ADMIN")
      .order("reservation_date", { ascending: true })
      .limit(5),
  ]);
  const studentIds = Array.from(new Set((pendingAdmin ?? []).map((r) => r.student_id)));
  const { data: students } =
    studentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, name, student_number")
          .in("id", studentIds)
      : { data: [] };
  const studentMap = new Map(students?.map((s) => [s.id, s]) ?? []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">행정실 대시보드</h1>
        <p className="mt-1 text-sm text-zinc-500">
          대규모·행사 예약 최종 승인, 운영 리포트, 자율 정책 설정.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-800">대규모·행사 최종 승인 대기</h2>
            <p className="mt-1 text-xs text-zinc-500">
              운영진이 1차 검토한 EVENT 종류의 예약을 최종 승인하세요.
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold">{pendingAdminCount ?? 0}건</div>
            <Link
              href="/admin/reservations?status=PENDING_ADMIN"
              className="text-xs text-zinc-500 underline"
            >
              전체 보기 →
            </Link>
          </div>
        </div>

        {pendingAdmin && pendingAdmin.length > 0 && (
          <ul className="mt-4 divide-y divide-zinc-100">
            {pendingAdmin.map((r) => {
              const student = studentMap.get(r.student_id);
              return (
                <li key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-zinc-800">
                      {r.room_code} · {r.reservation_date} · {r.start_period}
                      {r.end_period !== r.start_period ? `-${r.end_period}` : ""}교시
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {student?.name ?? "(이름 미입력)"} · {r.attendees}명 ·{" "}
                      {r.purpose ?? "목적 없음"}
                    </div>
                  </div>
                  <Link
                    href="/admin/reservations?status=PENDING_ADMIN"
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    처리하기
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <PlaceholderCard
          title="강의실 운영 리포트"
          hint="시간표 역산 × 체크인 × 신고 교차 분석 (월간/학기말)"
          status="MVP 이후"
        />
        <PlaceholderCard
          title="자율 정책 설정"
          hint="노쇼율 기반 체크인 유예시간 / 최대 예약 시간 조정"
          status="MVP 이후"
        />
      </div>
    </div>
  );
}

function PlaceholderCard({
  title,
  hint,
  status,
}: {
  title: string;
  hint: string;
  status: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">
          {status}
        </span>
      </div>
      <p className="mt-2 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}
