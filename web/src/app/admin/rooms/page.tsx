import { createClient } from "@/lib/supabase/server";
import type { DayOfWeek } from "@/lib/supabase/types";

const DAY_OPTIONS: Array<{ key: DayOfWeek; label: string }> = [
  { key: "MON", label: "월" },
  { key: "TUE", label: "화" },
  { key: "WED", label: "수" },
  { key: "THU", label: "목" },
  { key: "FRI", label: "금" },
];

const DEFAULT_PERIODS = ["01", "02", "03", "04", "05", "06", "07", "08", "09"];

type SP = { day?: string; night?: string };

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const day = (typeof sp.day === "string" && DAY_OPTIONS.some((d) => d.key === sp.day)
    ? sp.day
    : "MON") as DayOfWeek;
  const showNight = sp.night === "1";

  const supabase = await createClient();

  const [roomsRes, periodsRes, sessionsRes] = await Promise.all([
    supabase
      .from("rooms")
      .select("code, building, floor, category")
      .eq("in_scope", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("periods")
      .select("code, start_time, end_time, kind, sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("course_sessions")
      .select("room_code, period_code, courses(name, professor)")
      .eq("day", day),
  ]);

  const error = roomsRes.error ?? periodsRes.error ?? sessionsRes.error;
  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-xl font-semibold">빈 강의실 조회</h1>
        <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          조회 실패: {error.message}
        </div>
      </div>
    );
  }

  const rooms = roomsRes.data ?? [];
  const allPeriods = periodsRes.data ?? [];
  const periods = showNight
    ? allPeriods.filter((p) => p.kind !== "intensive")
    : allPeriods.filter((p) => DEFAULT_PERIODS.includes(p.code));

  // (room_code, period_code) → course info
  const occupancy = new Map<string, { name: string; professor: string | null }>();
  for (const s of sessionsRes.data ?? []) {
    if (!s.room_code) continue;
    const course = Array.isArray(s.courses) ? s.courses[0] : s.courses;
    occupancy.set(`${s.room_code}|${s.period_code}`, {
      name: course?.name ?? "",
      professor: course?.professor ?? null,
    });
  }

  // 건물/층별 그룹
  const groups = new Map<string, typeof rooms>();
  for (const r of rooms) {
    const key = `${r.building} · ${r.floor ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">빈 강의실 조회</h1>
          <p className="mt-1 text-sm text-zinc-500">
            시간표 역산 결과. 녹색은 비어있는 강의실, 회색은 수업 중.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <nav className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-sm">
            {DAY_OPTIONS.map((d) => {
              const next = new URLSearchParams();
              next.set("day", d.key);
              if (showNight) next.set("night", "1");
              return (
                <a
                  key={d.key}
                  href={`/admin/rooms?${next.toString()}`}
                  className={`rounded-md px-3 py-1.5 transition ${
                    day === d.key
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {d.label}
                </a>
              );
            })}
          </nav>
          <a
            href={`/admin/rooms?day=${day}${showNight ? "" : "&night=1"}`}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
          >
            {showNight ? "야간 숨기기" : "야간 포함"}
          </a>
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="sticky left-0 z-10 w-40 bg-zinc-50 px-3 py-2 text-left font-medium text-zinc-700">
                강의실
              </th>
              {periods.map((p) => (
                <th
                  key={p.code}
                  className="min-w-[72px] border-l border-zinc-200 px-2 py-2 text-center font-medium text-zinc-700"
                >
                  <div>{p.code}</div>
                  {p.start_time && (
                    <div className="font-normal text-zinc-400">
                      {p.start_time.slice(0, 5)}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(groups.entries()).map(([groupKey, groupRooms]) => (
              <>
                <tr key={`g-${groupKey}`} className="bg-zinc-50/50">
                  <td
                    colSpan={periods.length + 1}
                    className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                  >
                    {groupKey}
                  </td>
                </tr>
                {groupRooms.map((r) => (
                  <tr key={r.code} className="border-t border-zinc-100">
                    <td className="sticky left-0 z-10 bg-white px-3 py-1.5">
                      <div className="font-medium text-zinc-800">{r.code}</div>
                      <div className="text-[10px] text-zinc-400">{r.category}</div>
                    </td>
                    {periods.map((p) => {
                      const occ = occupancy.get(`${r.code}|${p.code}`);
                      return (
                        <td
                          key={p.code}
                          className={`border-l border-zinc-100 px-1 py-1 text-center ${
                            occ ? "bg-zinc-100 text-zinc-500" : "bg-emerald-50 text-emerald-700"
                          }`}
                          title={occ ? `${occ.name}${occ.professor ? ` · ${occ.professor}` : ""}` : "비어 있음"}
                        >
                          {occ ? (
                            <span className="line-clamp-1 text-[10px]">{occ.name}</span>
                          ) : (
                            <span className="text-[11px]">●</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
