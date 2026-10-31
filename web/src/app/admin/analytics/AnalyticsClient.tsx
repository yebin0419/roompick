"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Res = { room_id: string; status: string; start_time: string; end_time: string; is_event: boolean };
type Room = { id: string; code: string; building: string; floor: string | null; capacity: number | null; room_type: string | null };
type Report = { room_id: string | null; category: string; status: string; created_at: string };
type Policy = { key: string; value: any; description: string | null };

export default function AnalyticsClient({
  reservations, rooms, reports, policies,
}: {
  reservations: Res[]; rooms: Room[]; reports: Report[]; policies: Policy[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const stats = useMemo(() => {
    const byRoom = new Map<string, { total: number; checked: number; cancelled: number; noShow: number; hours: number }>();
    for (const r of rooms) byRoom.set(r.id, { total: 0, checked: 0, cancelled: 0, noShow: 0, hours: 0 });
    for (const r of reservations) {
      const s = byRoom.get(r.room_id);
      if (!s) continue;
      s.total++;
      if (r.status === "CHECKED_IN" || r.status === "COMPLETED") s.checked++;
      if (r.status === "CANCELLED") s.cancelled++;
      if (r.status === "NO_SHOW") s.noShow++;
      s.hours += (new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 3600000;
    }
    const noShowRate = (s: { total: number; noShow: number }) => s.total === 0 ? 0 : s.noShow / s.total;
    const totalRes = reservations.length;
    const totalNoShow = reservations.filter((r) => r.status === "NO_SHOW").length;
    return { byRoom, totalRes, totalNoShow, overallNoShow: totalRes === 0 ? 0 : totalNoShow / totalRes, noShowRate };
  }, [rooms, reservations]);

  const [policyMap, setPolicyMap] = useState<Record<string, any>>(
    () => Object.fromEntries(policies.map((p) => [p.key, p.value])),
  );
  const [saving, setSaving] = useState(false);

  async function savePolicy(key: string, value: any) {
    setSaving(true);
    await supabase.from("system_policies").update({ value }).eq("key", key);
    setSaving(false); router.refresh();
  }

  const topRooms = [...rooms]
    .map((r) => ({ r, s: stats.byRoom.get(r.id)! }))
    .sort((a, b) => b.s.hours - a.s.hours)
    .slice(0, 10);

  const underused = [...rooms]
    .map((r) => ({ r, s: stats.byRoom.get(r.id)! }))
    .sort((a, b) => a.s.hours - b.s.hours)
    .slice(0, 5);

  const reportCount: Record<string, number> = {};
  for (const r of reports) reportCount[r.category] = (reportCount[r.category] ?? 0) + 1;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">운영 리포트</h1>
        <p className="mt-1 text-sm text-slate-500">
          최근 30일 데이터 기반 교차 분석 · 공간 재배치/투자 의사결정 참고
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="총 예약" value={stats.totalRes.toString()} />
        <Metric label="노쇼" value={stats.totalNoShow.toString()} />
        <Metric label="전체 노쇼율" value={`${(stats.overallNoShow * 100).toFixed(1)}%`} />
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900">사용 상위 강의실</h2>
        <ul className="mt-3 space-y-2">
          {topRooms.map(({ r, s }) => (
            <li key={r.id} className="flex items-center gap-3">
              <span className="w-24 text-sm font-medium text-slate-900">{r.code}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500"
                  style={{ width: `${Math.min(100, (s.hours / (topRooms[0]?.s.hours || 1)) * 100)}%` }}
                />
              </div>
              <span className="w-20 text-right text-xs text-slate-500 tabular-nums">
                {s.hours.toFixed(1)}h · 노쇼 {(stats.noShowRate(s) * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900">사용 저조 (재배치/투자 검토)</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {underused.map(({ r, s }) => (
            <li key={r.id} className="rounded-xl border border-slate-100 p-3 text-sm">
              <p className="font-medium text-slate-900">{r.code} · {r.room_type}</p>
              <p className="text-xs text-slate-500">
                30일 {s.hours.toFixed(1)}h · {s.total}건 · 노쇼 {s.noShow}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900">신고 카테고리</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {Object.entries(reportCount).map(([k, v]) => (
            <li key={k} className="text-xs rounded-full bg-slate-100 px-3 py-1.5">
              {k} · {v}
            </li>
          ))}
          {Object.keys(reportCount).length === 0 && (
            <p className="text-sm text-slate-500">최근 30일 신고 없음</p>
          )}
        </ul>
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900">자율 조정 정책</h2>
        <p className="mt-1 text-sm text-slate-500">
          노쇼율·이용량에 따라 유예 시간과 최대 예약시간을 조정합니다.
        </p>
        <div className="mt-4 space-y-3">
          {policies.map((p) => (
            <div key={p.key} className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{p.key}</p>
                <p className="text-xs text-slate-500">{p.description}</p>
              </div>
              <input
                type="number"
                className="w-28 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-right"
                value={typeof policyMap[p.key] === "number" ? policyMap[p.key] : Number(policyMap[p.key] ?? 0)}
                onChange={(e) =>
                  setPolicyMap({ ...policyMap, [p.key]: Number(e.target.value) })
                }
              />
              <button
                onClick={() => savePolicy(p.key, policyMap[p.key])} disabled={saving}
                className="text-xs rounded-md bg-slate-900 text-white px-3 py-1.5 disabled:opacity-50"
              >
                저장
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
