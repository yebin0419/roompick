import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  deletePeriodOverride,
  updateGlobalPolicy,
  upsertPeriodOverride,
} from "./actions";

const NO_SHOW_THRESHOLD = 0.15; // 15% 이상이면 유예 단축 추천
const MIN_SAMPLE = 5; // 승인 건수 ≥5 에서만 통계적으로 의미 있다고 판단
const SUGGESTED_GRACE = 5;

export default async function PolicyPage() {
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

  const [
    globalRes,
    overridesRes,
    periodsRes,
    reservationsRes,
  ] = await Promise.all([
    supabase.from("policy_rules").select("*").eq("scope", "global").maybeSingle(),
    supabase
      .from("policy_rules")
      .select("*")
      .eq("scope", "period")
      .order("period_code", { ascending: true }),
    supabase
      .from("periods")
      .select("code, start_time, end_time, kind, sort_order")
      .in("kind", ["regular", "night"])
      .order("sort_order", { ascending: true }),
    supabase
      .from("reservations")
      .select("start_period, status, no_show")
      .or("status.in.(AUTO_APPROVED,APPROVED),no_show.eq.true"),
  ]);

  const globalRule = globalRes.data;
  const overrides = overridesRes.data ?? [];
  const periods = periodsRes.data ?? [];
  const overrideMap = new Map(overrides.map((o) => [o.period_code!, o]));

  // ===== 교시별 노쇼율 =====
  const perPeriod = new Map<string, { approved: number; noShows: number }>();
  for (const r of reservationsRes.data ?? []) {
    const slot = perPeriod.get(r.start_period) ?? { approved: 0, noShows: 0 };
    if (r.status === "AUTO_APPROVED" || r.status === "APPROVED") slot.approved += 1;
    if (r.no_show) slot.noShows += 1;
    perPeriod.set(r.start_period, slot);
  }
  const suggestions = Array.from(perPeriod.entries())
    .map(([period, s]) => ({
      period,
      approved: s.approved,
      noShows: s.noShows,
      rate: s.approved > 0 ? s.noShows / s.approved : 0,
    }))
    .filter((s) => s.approved >= MIN_SAMPLE && s.rate >= NO_SHOW_THRESHOLD)
    .sort((a, b) => b.rate - a.rate);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">자율 조정 정책</h1>
        <p className="mt-1 text-sm text-zinc-500">
          체크인 유예시간과 최대 예약 가능 교시를 조정합니다. 교시별 오버라이드가 전역값보다 우선.
        </p>
      </header>

      {/* 전역 기본값 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">전역 기본값</h2>
        <p className="mt-1 text-xs text-zinc-500">
          교시별 오버라이드가 없을 때 사용됩니다.
        </p>
        <form action={updateGlobalPolicy} className="mt-4 flex flex-wrap items-end gap-4">
          <NumberField
            name="grace"
            label="체크인 유예 (분)"
            defaultValue={globalRule?.check_in_grace_minutes ?? 15}
            min={0}
            max={60}
          />
          <NumberField
            name="max"
            label="최대 예약 교시"
            defaultValue={globalRule?.max_reservation_periods ?? 3}
            min={1}
            max={9}
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            저장
          </button>
        </form>
        {globalRule && (
          <p className="mt-3 text-[11px] text-zinc-400">
            마지막 수정: {new Date(globalRule.updated_at).toLocaleString("ko-KR")}
          </p>
        )}
      </section>

      {/* 자동 추천 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">자동 추천</h2>
        <p className="mt-1 text-xs text-zinc-500">
          노쇼율 {Math.round(NO_SHOW_THRESHOLD * 100)}% 이상 (승인 ≥ {MIN_SAMPLE}건) 교시는 유예
          단축 ({SUGGESTED_GRACE}분)이 권장됩니다.
        </p>
        {suggestions.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-zinc-200 py-6 text-center text-xs text-zinc-400">
            추천할 변경이 없습니다. 노쇼율이 양호합니다.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {suggestions.map((s) => {
              const current =
                overrideMap.get(s.period)?.check_in_grace_minutes ??
                globalRule?.check_in_grace_minutes ??
                15;
              const alreadyApplied = current <= SUGGESTED_GRACE;
              return (
                <li
                  key={s.period}
                  className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-semibold text-zinc-800">{s.period}교시</span>
                    <span className="ml-2 text-xs text-zinc-600">
                      노쇼율 {Math.round(s.rate * 100)}% ({s.noShows}/{s.approved})
                    </span>
                    <span className="ml-2 text-xs text-zinc-400">
                      현재 유예 {current}분
                    </span>
                  </div>
                  {alreadyApplied ? (
                    <span className="text-xs text-emerald-700">이미 적용됨</span>
                  ) : (
                    <form action={upsertPeriodOverride}>
                      <input type="hidden" name="period" value={s.period} />
                      <input type="hidden" name="grace" value={SUGGESTED_GRACE} />
                      <input
                        type="hidden"
                        name="max"
                        value={
                          overrideMap.get(s.period)?.max_reservation_periods ??
                          globalRule?.max_reservation_periods ??
                          3
                        }
                      />
                      <button
                        type="submit"
                        className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500"
                      >
                        유예 {SUGGESTED_GRACE}분으로 단축
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 교시별 오버라이드 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">교시별 오버라이드</h2>
        <p className="mt-1 text-xs text-zinc-500">
          특정 교시만 다른 값을 적용하고 싶을 때 사용. 빈칸으로 저장하면 전역값으로 폴백.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="py-2 font-medium">교시</th>
                <th className="py-2 font-medium">시간</th>
                <th className="py-2 font-medium">유예 (분)</th>
                <th className="py-2 font-medium">최대 교시</th>
                <th className="py-2 font-medium w-32">액션</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                const o = overrideMap.get(p.code);
                return (
                  <tr key={p.code} className="border-b border-zinc-100">
                    <td className="py-2 font-medium text-zinc-800">{p.code}</td>
                    <td className="py-2 text-zinc-500">
                      {p.start_time?.slice(0, 5) ?? "-"} ~ {p.end_time?.slice(0, 5) ?? "-"}
                    </td>
                    <td className="py-2">
                      <form
                        action={upsertPeriodOverride}
                        className="flex items-center gap-2"
                        id={`form-${p.code}`}
                      >
                        <input type="hidden" name="period" value={p.code} />
                        <input
                          name="grace"
                          defaultValue={
                            o?.check_in_grace_minutes ??
                            globalRule?.check_in_grace_minutes ??
                            15
                          }
                          type="number"
                          min={0}
                          max={60}
                          className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-xs"
                        />
                        <input
                          name="max"
                          defaultValue={
                            o?.max_reservation_periods ??
                            globalRule?.max_reservation_periods ??
                            3
                          }
                          type="number"
                          min={1}
                          max={9}
                          hidden
                        />
                      </form>
                    </td>
                    <td className="py-2">
                      <input
                        form={`form-${p.code}`}
                        name="max"
                        defaultValue={
                          o?.max_reservation_periods ??
                          globalRule?.max_reservation_periods ??
                          3
                        }
                        type="number"
                        min={1}
                        max={9}
                        className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          form={`form-${p.code}`}
                          type="submit"
                          className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] hover:bg-zinc-50"
                        >
                          저장
                        </button>
                        {o && (
                          <form action={deletePeriodOverride}>
                            <input type="hidden" name="period" value={p.code} />
                            <button
                              type="submit"
                              className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50"
                            >
                              리셋
                            </button>
                          </form>
                        )}
                        {o ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                            override
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">
                            전역
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
  min,
  max,
}: {
  name: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-600">{label}</span>
      <input
        name={name}
        type="number"
        min={min}
        max={max}
        defaultValue={defaultValue}
        className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
      />
    </label>
  );
}
