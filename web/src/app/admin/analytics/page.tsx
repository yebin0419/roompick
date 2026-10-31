import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { ReportCategory } from "@/lib/supabase/types";

const CATEGORY_LABEL: Record<ReportCategory, string> = {
  UNAUTHORIZED_USE: "무단 점유",
  EQUIPMENT_BROKEN: "비품 고장",
  CLEANLINESS: "청결 문제",
  OTHER: "기타",
};

type MetricKey = "reservations" | "checkin" | "noshow" | "reports";

const METRICS: Array<{ key: MetricKey; label: string; unit: string }> = [
  { key: "reservations", label: "예약 수", unit: "건" },
  { key: "checkin", label: "체크인률", unit: "%" },
  { key: "noshow", label: "노쇼", unit: "건" },
  { key: "reports", label: "신고", unit: "건" },
];

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    startIso: iso(start),
    endIso: iso(end),
    label: `${now.getFullYear()}년 ${now.getMonth() + 1}월`,
  };
}

function last6Months(): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

type SP = { metric?: string };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const metric = (METRICS.some((m) => m.key === sp.metric)
    ? sp.metric
    : "reservations") as MetricKey;

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

  const { startIso, endIso, label } = monthRange();
  const months = last6Months();
  const trendStart = `${months[0]}-01`;

  const [
    monthReservationsRes,
    utilizationRes,
    reportsAllRes,
    noShowDetailRes,
    openReportsRes,
    monthlyRsvRes,
    monthlyRepRes,
  ] = await Promise.all([
    supabase
      .from("reservations")
      .select("status, checked_in_at, no_show, start_period", { count: "exact" })
      .gte("reservation_date", startIso)
      .lt("reservation_date", endIso),
    supabase
      .from("room_weekly_utilization")
      .select("*")
      .order("idle_pct", { ascending: false }),
    supabase.from("reports").select("category, room_code, status"),
    supabase
      .from("reservations")
      .select("start_period, room_code, reservation_date")
      .eq("no_show", true)
      .gte("reservation_date", startIso)
      .lt("reservation_date", endIso),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["OPEN", "IN_PROGRESS"]),
    supabase
      .from("monthly_reservation_stats")
      .select("*")
      .gte("month", months[0])
      .order("month", { ascending: true }),
    supabase
      .from("monthly_report_stats")
      .select("*")
      .gte("month", months[0])
      .order("month", { ascending: true }),
  ]);

  // ===== KPI =====
  const monthRows = monthReservationsRes.data ?? [];
  const totalReservations = monthReservationsRes.count ?? monthRows.length;
  const approvedForCheckIn = monthRows.filter(
    (r) => r.status === "AUTO_APPROVED" || r.status === "APPROVED",
  );
  const checkedIn = approvedForCheckIn.filter((r) => r.checked_in_at).length;
  const checkInRate =
    approvedForCheckIn.length > 0
      ? Math.round((checkedIn / approvedForCheckIn.length) * 100)
      : 0;
  const monthNoShows = monthRows.filter((r) => r.no_show).length;
  const openReports = openReportsRes.count ?? 0;

  // ===== 추이 =====
  const rsvByMonth = new Map((monthlyRsvRes.data ?? []).map((r) => [r.month, r]));
  const repByMonth = new Map((monthlyRepRes.data ?? []).map((r) => [r.month, r]));
  const trendValues: number[] = months.map((m) => {
    const rsv = rsvByMonth.get(m);
    const rep = repByMonth.get(m);
    switch (metric) {
      case "reservations":
        return rsv?.total ?? 0;
      case "checkin":
        return rsv && rsv.approved > 0
          ? Math.round((rsv.checked_in / rsv.approved) * 100)
          : 0;
      case "noshow":
        return rsv?.no_show ?? 0;
      case "reports":
        return rep?.total ?? 0;
    }
  });
  const trendUnit = METRICS.find((m) => m.key === metric)!.unit;

  // ===== 유휴율 TOP =====
  const utilization = utilizationRes.data ?? [];
  const utilizationTop = utilization.slice(0, 10);

  // ===== 신고 분포 =====
  const reports = reportsAllRes.data ?? [];
  const byCategory = new Map<ReportCategory, number>();
  const byRoom = new Map<string, number>();
  for (const r of reports) {
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);
    if (r.room_code) byRoom.set(r.room_code, (byRoom.get(r.room_code) ?? 0) + 1);
  }
  const categoryEntries = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);
  const categoryMax = Math.max(1, ...categoryEntries.map(([, v]) => v));
  const roomEntries = Array.from(byRoom.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const roomMax = Math.max(1, ...roomEntries.map(([, v]) => v));

  // ===== 노쇼 분포 =====
  const noShowRows = noShowDetailRes.data ?? [];
  const noShowByPeriod = new Map<string, number>();
  for (const n of noShowRows) {
    noShowByPeriod.set(n.start_period, (noShowByPeriod.get(n.start_period) ?? 0) + 1);
  }
  const noShowEntries = Array.from(noShowByPeriod.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const noShowMax = Math.max(1, ...noShowEntries.map(([, v]) => v));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">강의실 운영 리포트</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {label} 기준. 시간표 역산 × 체크인 × 신고 교차 분석.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            href="/admin/analytics/archive"
            className="rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-800"
          >
            리포트 아카이브 →
          </Link>
          <ExportLink section="monthly" label="월간 추이 CSV" />
          <ExportLink section="utilization" label="유휴율 CSV" />
          <ExportLink section="reports-by-room" label="신고/강의실 CSV" />
          <ExportLink section="no-shows" label="노쇼 CSV" />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard title="이번 달 예약" value={`${totalReservations}건`} />
        <KpiCard
          title="체크인률"
          value={`${checkInRate}%`}
          hint={`${checkedIn}/${approvedForCheckIn.length}`}
        />
        <KpiCard
          title="이번 달 노쇼"
          value={`${monthNoShows}건`}
          tone={monthNoShows > 0 ? "warning" : undefined}
        />
        <KpiCard
          title="미처리 신고"
          value={`${openReports}건`}
          tone={openReports > 0 ? "danger" : undefined}
        />
      </section>

      <Panel
        title={`최근 6개월 추이 (${months[0]} ~ ${months[5]})`}
        subtitle="월별 집계. 지표 전환 가능."
      >
        <nav className="mb-4 flex flex-wrap gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-xs w-fit">
          {METRICS.map((m) => (
            <Link
              key={m.key}
              href={`/admin/analytics?metric=${m.key}`}
              className={`rounded-md px-3 py-1.5 transition ${
                metric === m.key
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {m.label}
            </Link>
          ))}
        </nav>
        <TrendBarChart months={months} values={trendValues} unit={trendUnit} />
      </Panel>

      <Panel
        title="공간 재배치 후보 (유휴율 TOP)"
        subtitle="수업으로 점유된 교시 수 기준. 유휴율 높은 강의실일수록 분할/용도 변경 후보."
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500">
              <th className="py-2 font-medium">강의실</th>
              <th className="py-2 font-medium">위치</th>
              <th className="py-2 font-medium">주당 수업</th>
              <th className="py-2 font-medium w-[46%]">유휴율</th>
            </tr>
          </thead>
          <tbody>
            {utilizationTop.map((u) => (
              <tr key={u.code} className="border-b border-zinc-100">
                <td className="py-2 font-medium text-zinc-800">{u.code}</td>
                <td className="py-2 text-zinc-500">
                  {u.building} · {u.floor ?? "-"} · {u.category ?? "-"}
                </td>
                <td className="py-2 text-zinc-700">{u.scheduled_slots}/45</td>
                <td className="py-2">
                  <Bar pct={Number(u.idle_pct)} label={`${u.idle_pct}%`} tone="emerald" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Panel
          title="시설 투자 우선순위"
          subtitle="신고 다발 강의실. 비품 고장·청결 신고 포함."
        >
          {roomEntries.length === 0 ? (
            <Empty text="신고 데이터가 없습니다." />
          ) : (
            <ul className="space-y-1.5">
              {roomEntries.map(([room, cnt]) => (
                <li key={room} className="flex items-center gap-3 text-xs">
                  <span className="w-20 font-medium text-zinc-800">{room}</span>
                  <div className="flex-1">
                    <Bar pct={(cnt / roomMax) * 100} label={`${cnt}건`} tone="amber" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="신고 카테고리 분포"
          subtitle="전체 기간 집계. 처리 상태 무관."
        >
          {categoryEntries.length === 0 ? (
            <Empty text="신고 데이터가 없습니다." />
          ) : (
            <ul className="space-y-1.5">
              {categoryEntries.map(([cat, cnt]) => (
                <li key={cat} className="flex items-center gap-3 text-xs">
                  <span className="w-20 font-medium text-zinc-800">
                    {CATEGORY_LABEL[cat]}
                  </span>
                  <div className="flex-1">
                    <Bar pct={(cnt / categoryMax) * 100} label={`${cnt}건`} tone="zinc" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="노쇼 상습 발생 시간대"
        subtitle={`${label} 기준. 체크인 유예시간 조정 참고 자료.`}
      >
        {noShowEntries.length === 0 ? (
          <Empty text="이번 달 노쇼가 없습니다." />
        ) : (
          <ul className="space-y-1.5">
            {noShowEntries.map(([period, cnt]) => (
              <li key={period} className="flex items-center gap-3 text-xs">
                <span className="w-16 font-medium text-zinc-800">{period}교시</span>
                <div className="flex-1">
                  <Bar pct={(cnt / noShowMax) * 100} label={`${cnt}건`} tone="red" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-200 bg-red-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : "border-zinc-200 bg-white";
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="text-xs text-zinc-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-zinc-900">{value}</div>
      {hint && <div className="mt-1 text-[10px] text-zinc-400">{hint}</div>}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
      {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Bar({
  pct,
  label,
  tone,
}: {
  pct: number;
  label: string;
  tone: "emerald" | "amber" | "red" | "zinc";
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const fill =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : tone === "red"
          ? "bg-red-500"
          : "bg-zinc-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full ${fill}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-14 text-right tabular-nums text-zinc-600">{label}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-200 py-6 text-center text-xs text-zinc-400">
      {text}
    </div>
  );
}

function ExportLink({ section, label }: { section: string; label: string }) {
  return (
    <Link
      href={`/admin/analytics/export?section=${section}`}
      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
    >
      ↓ {label}
    </Link>
  );
}

function TrendBarChart({
  months,
  values,
  unit,
}: {
  months: string[];
  values: number[];
  unit: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-3 h-40">
      {months.map((m, i) => {
        const h = (values[i] / max) * 100;
        return (
          <div key={m} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="relative flex h-full w-full items-end">
              <div
                className="w-full rounded-t bg-zinc-900 transition-all"
                style={{ height: `${h}%`, minHeight: values[i] > 0 ? 4 : 0 }}
              />
              <span className="absolute left-1/2 -translate-x-1/2 -translate-y-5 text-[10px] font-semibold text-zinc-700"
                    style={{ bottom: `${h}%` }}>
                {values[i]}
                <span className="text-zinc-400 ml-0.5">{unit}</span>
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 tabular-nums">{m}</span>
          </div>
        );
      })}
    </div>
  );
}
